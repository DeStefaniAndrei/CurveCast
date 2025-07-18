// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@polytope-labs/ismp-solidity/interfaces/IDispatcher.sol";
import "@polytope-labs/ismp-solidity/interfaces/IIsmpModule.sol";
import "@polytope-labs/ismp-solidity/interfaces/Message.sol";
import "@polytope-labs/ismp-solidity/interfaces/StateMachine.sol";
import { IncomingPostResponse } from "@polytope-labs/ismp-solidity/interfaces/IIsmpModule.sol";
import { PostResponse } from "@polytope-labs/ismp-solidity/interfaces/Message.sol";
import { DispatchPost } from "@polytope-labs/ismp-solidity/interfaces/IDispatcher.sol";
import { DispatchGet } from "@polytope-labs/ismp-solidity/interfaces/IDispatcher.sol";
import "hardhat/console.sol";

interface ITokenFaucet {
    // drips the feeToken once per day
    function drip(address) external;
}

contract PredictionMarket is Ownable, IIsmpModule {
    enum MarketState { Open, Closed, Resolved }

    struct Prediction {
        address user;
        uint256 mean;
        uint256 stddev;
        uint256 stake;
    }

    string public prompt;
    string public asset;
    //close time in UNIX
    uint256 public closeTime;
    MarketState public state;
    uint256 public outcome;
    Prediction[] public predictions;

    // --- Hyperbridge Cross-Chain Price Feed Support ---
    address public dispatcher; // Hyperbridge dispatcher contract address
    bytes public destination;  // Encoded destination (state machine + responder address)
    bool public priceRequested;

    // --- Distribution Market State ---
    uint256 public marketMean;
    uint256 public marketStddev;
    uint256 public minStddev = 1e6; // Minimum stddev to prevent peaked distributions (tunable)

    struct Trade {
        address user;
        uint256 oldMean;
        uint256 oldStddev;
        uint256 newMean;
        uint256 newStddev;
        uint256 stake;
        uint256 blockNumber;
    }
    Trade[] public trades;

    event PredictionSubmitted(address indexed user, uint256 mean, uint256 stddev, uint256 stake);
    event MarketClosed();
    event MarketResolved(uint256 outcome);
    event PriceRequested(bytes destination, bytes payload);
    event PriceReceived(uint256 price);
    event Payout(address indexed user, uint256 amount, int256 pnl);

    modifier onlyOpen() {
        require(state == MarketState.Open, "Market not open");
        require(block.timestamp < closeTime, "Market closed by time");
        _;
    }

    modifier onlyClosed() {
        require(state == MarketState.Closed, "Market not closed");
        _;
    }

    constructor(
        string memory _prompt,
        string memory _asset,
        uint256 _closeTime,
        address admin,
        address _dispatcher,
        bytes memory _destination,
        uint256 _initialMean,
        uint256 _initialStddev
    ) Ownable(admin) {
        console.log("_initialStddev:", _initialStddev);
        console.log("minStddev:", minStddev);
        console.log("Constructor starting...");
        prompt = _prompt;
        console.log("prompt set");
        asset = _asset;
        console.log("asset set");
        closeTime = _closeTime;
        console.log("closeTime set");
        state = MarketState.Open;
        console.log("state set");
        dispatcher = _dispatcher;
        console.log("dispatcher set");
        destination = _destination;
        console.log("destination set");
        priceRequested = false;
        console.log("priceRequested set");
        marketMean = _initialMean;
        console.log("marketMean set");
        marketStddev = _initialStddev;
        console.log("after marketStddev assignment");
        // require(_initialStddev >= minStddev, "Initial stddev too low");
        console.log("Constructor completed successfully");
        // Setup fee token approval for Hyperbridge requests
        if (dispatcher != address(0)) {
            try IDispatcher(dispatcher).feeToken() returns (address feeToken) {
                // Note: In production, you'd want to handle this more carefully
                // For hackathon, we'll assume the contract has sufficient tokens
                console.log("Fee token address:", feeToken);
            } catch {
                console.log("Could not get fee token from dispatcher");
            }
        }
    }

    // Helper: log(stddev) in 1e18 fixed point
    function log1e18(uint256 x) private pure returns (int256) {
        require(x > 0, "log domain");
        // Use a simple log2 approximation and scale by ln(2)
        // For hackathon, this is a placeholder. Replace with a proper math lib for production.
        // log2(x) * ln(2) = ln(x)
        // We'll use log2(x) = log2(x) from OpenZeppelin or similar, but here just a stub:
        // For now, use log2(x) = 0 for simplicity (replace with real implementation)
        return 0;
    }

    function _scoringRule(int256 mu, int256 sigma, int256 x) private pure returns (int256) {
        return -((x - mu) * (x - mu)) * 1e18 / (2 * sigma * sigma) - log1e18(uint256(sigma));
    }

    function submitPrediction(uint256 mean, uint256 stddev) external payable onlyOpen {
        require(msg.value > 0, "Stake required");
        require(stddev >= minStddev, "Stddev too low");

        int256 oldMean = int256(marketMean);
        int256 oldStddev = int256(marketStddev);
        int256 newMean = int256(mean);
        int256 newStddev = int256(stddev);

        // Calculate S(old, x) - S(new, x) at x = oldMean and x = newMean
        int256 diff1 = _scoringRule(oldMean, oldStddev, oldMean) - _scoringRule(newMean, newStddev, oldMean);
        int256 diff2 = _scoringRule(oldMean, oldStddev, newMean) - _scoringRule(newMean, newStddev, newMean);
        int256 collateral = diff1 > diff2 ? diff1 : diff2;
        if (collateral < 0) collateral = 0;
        uint256 requiredCollateral = uint256(collateral) / 1e18;
        require(msg.value >= requiredCollateral, "Insufficient collateral");

        uint256 oldMarketMean = marketMean;
        uint256 oldMarketStddev = marketStddev;
        marketMean = mean;
        marketStddev = stddev;

        trades.push(Trade({
            user: msg.sender,
            oldMean: oldMarketMean,
            oldStddev: oldMarketStddev,
            newMean: mean,
            newStddev: stddev,
            stake: msg.value,
            blockNumber: block.number
        }));

        emit PredictionSubmitted(msg.sender, mean, stddev, msg.value);
    }

    function closeMarket() external onlyOwner {
        require(state == MarketState.Open, "Already closed");
        require(block.timestamp >= closeTime, "Too early to close");
        state = MarketState.Closed;
        emit MarketClosed();
    }

    // --- Hyperbridge: Request price from Chainlink feed via GET request ---
    function requestPriceGet(address chainlinkFeed, uint64 timeout, uint256 fee) external onlyOwner onlyClosed {
        require(!priceRequested, "Price already requested");
        
        // Encode the Chainlink feed address and slot for latest answer
        // Chainlink price feeds store the latest answer at slot 0
        bytes memory key = abi.encodePacked(
            chainlinkFeed,
            bytes32(uint256(0)) // slot 0 for latest answer
        );
        bytes[] memory keys = new bytes[](1);
        keys[0] = key;
        
        // Use the destination stored in the contract
        uint64 height = 0; // latest block (0 means latest)
        bytes memory context = "";
        
        DispatchGet memory getRequest = DispatchGet({
            dest: destination,
            height: height,
            keys: keys,
            timeout: timeout,
            fee: fee,
            context: context
        });
        
        IDispatcher(dispatcher).dispatch(getRequest);
        priceRequested = true;
        emit PriceRequested(destination, key);
    }

    // --- Hyperbridge: Handle cross-chain GET response (price) ---
    function onGetResponse(IncomingGetResponse memory incoming) external override {
        // For testing: allow owner calls if dispatcher is ZeroAddress
        if (dispatcher != address(0)) {
            require(msg.sender == dispatcher, "Only dispatcher can call");
        } else {
            require(msg.sender == owner(), "Only owner can call in test mode");
        }
        require(state == MarketState.Closed, "Market not closed");
        require(incoming.response.values.length > 0, "No response data");
        int256 price = abi.decode(incoming.response.values[0].value, (int256));
        outcome = uint256(price);
        state = MarketState.Resolved;
        emit PriceReceived(uint256(price));
        emit MarketResolved(uint256(price));
        // --- Distribution Market Payouts ---
        for (uint256 i = 0; i < trades.length; i++) {
            Trade memory t = trades[i];
            int256 x = int256(outcome);
            int256 oldMean = int256(t.oldMean);
            int256 oldStddev = int256(t.oldStddev);
            int256 newMean = int256(t.newMean);
            int256 newStddev = int256(t.newStddev);
            int256 s_old = _scoringRule(oldMean, oldStddev, x);
            int256 s_new = _scoringRule(newMean, newStddev, x);
            int256 pnl = (s_old - s_new) * int256(t.stake) / 1e18;
            int256 payout = int256(t.stake) + pnl;
            if (payout < 0) payout = 0;
            if (payout > 0) {
                payable(t.user).transfer(uint256(payout));
            }
            emit Payout(t.user, uint256(payout), pnl);
        }
        // Payouts complete
    }

    // --- Required by IIsmpModule, but not used ---
    function onPostResponse(IncomingPostResponse memory) external override {}
    function onAccept(IncomingPostRequest memory) external override {}
    function onGetTimeout(GetRequest memory) external override {}
    function onPostRequestTimeout(PostRequest memory) external override {}
    function onPostResponseTimeout(PostResponse memory) external override {}

    function getPredictions() external view returns (Prediction[] memory) {
        return predictions;
    }

    // --- Automated close and price request ---
    function autoCloseAndRequest(address chainlinkFeed, uint64 timeout, uint256 fee) external {
        if (state == MarketState.Open && block.timestamp >= closeTime) {
            closeMarket();
        }
        require(state == MarketState.Closed, "Market must be closed");
        requestPriceGet(chainlinkFeed, timeout, fee);
    }
} 