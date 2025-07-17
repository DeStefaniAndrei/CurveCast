// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@polytope-labs/ismp-solidity/interfaces/IDispatcher.sol";
import "@polytope-labs/ismp-solidity/interfaces/IIsmpModule.sol";
import "@polytope-labs/ismp-solidity/interfaces/Message.sol";
import { IncomingPostResponse } from "@polytope-labs/ismp-solidity/interfaces/IIsmpModule.sol";
import { PostResponse } from "@polytope-labs/ismp-solidity/interfaces/Message.sol";
import { DispatchPost } from "@polytope-labs/ismp-solidity/interfaces/IDispatcher.sol";
import { DispatchGet } from "@polytope-labs/ismp-solidity/interfaces/IDispatcher.sol";

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

    event PredictionSubmitted(address indexed user, uint256 mean, uint256 stddev, uint256 stake);
    event MarketClosed();
    event MarketResolved(uint256 outcome);
    event PriceRequested(bytes destination, bytes payload);
    event PriceReceived(uint256 price);

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
        bytes memory _destination
    ) Ownable(admin) {
        prompt = _prompt;
        asset = _asset;
        closeTime = _closeTime;
        state = MarketState.Open;
        dispatcher = _dispatcher;
        destination = _destination;
        priceRequested = false;
        // Faucet logic (commented out, can be restored if needed):
        // address feetoken = IDispatcher(dispatcher).feeToken();
        // ITokenFaucet(0x1794aB22388303ce9Cb798bE966eeEBeFe59C3a3).drip(feetoken);
        // IERC20(feetoken).approve(dispatcher, type(uint256).max);
    }

    function submitPrediction(uint256 mean, uint256 stddev) external payable onlyOpen {
        require(msg.value > 0, "Stake required");
        predictions.push(Prediction({
            user: msg.sender,
            mean: mean,
            stddev: stddev,
            stake: msg.value
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
        bytes memory key = abi.encodePacked(
            chainlinkFeed,
            bytes32(uint256(0)) // slot 0 for latest answer
        );
        bytes[] memory keys = new bytes[](1);
        keys[0] = key;
        bytes memory dest = hex"0000000000000000000000000000000000000000"; // Placeholder
        uint64 height = 0; // latest block
        bytes memory context = "";
        DispatchGet memory getRequest = DispatchGet({
            dest: dest,
            height: height,
            keys: keys,
            timeout: timeout,
            fee: fee,
            context: context
        });
        IDispatcher(dispatcher).dispatch(getRequest);
        priceRequested = true;
        emit PriceRequested(dest, key);
    }

    // --- Hyperbridge: Handle cross-chain GET response (price) ---
    function onGetResponse(IncomingGetResponse memory incoming) external override {
        require(state == MarketState.Closed, "Market not closed");
        require(incoming.response.values.length > 0, "No response data");
        int256 price = abi.decode(incoming.response.values[0].value, (int256));
        outcome = uint256(price);
        state = MarketState.Resolved;
        emit PriceReceived(uint256(price));
        emit MarketResolved(uint256(price));
        // Payout logic to be implemented
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
} 