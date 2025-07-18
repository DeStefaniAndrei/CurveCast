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
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ITokenFaucetV2 {
    function drip(address) external;
}

contract PredictionMarketV2 is Ownable, IIsmpModule {
    string public constant VERSION = "V2";
    enum MarketState { Open, Closed, Resolved }
    struct Prediction {
        address user;
        uint256 mean;
        uint256 stddev;
        uint256 stake;
    }
    string public prompt;
    string public asset;
    uint256 public closeTime;
    MarketState public state;
    uint256 public outcome;
    Prediction[] public predictions;
    address public dispatcher;
    bytes public destination;
    bool public priceRequested;
    uint256 public marketMean;
    uint256 public marketStddev;
    uint256 public minStddev = 1e6;
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
    event PredictionSubmittedV2(address indexed user, uint256 mean, uint256 stddev, uint256 stake);
    event MarketClosedV2();
    event MarketResolvedV2(uint256 outcome);
    event PriceRequestedV2(bytes destination, bytes payload);
    event PriceReceivedV2(uint256 price);
    event PayoutV2(address indexed user, uint256 amount, int256 pnl);
    event FeeTokenSpentV2(address indexed market, uint256 amount);
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
        prompt = _prompt;
        asset = _asset;
        closeTime = _closeTime;
        state = MarketState.Open;
        dispatcher = _dispatcher;
        destination = _destination;
        priceRequested = false;
        marketMean = _initialMean;
        marketStddev = _initialStddev;
        address feeToken = 0xA801da100bF16D07F668F4A49E1f71fc54D05177;
        IERC20(feeToken).approve(dispatcher, type(uint256).max);
    }
    function log1e18(uint256 x) private pure returns (int256) {
        require(x > 0, "log domain");
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
        emit PredictionSubmittedV2(msg.sender, mean, stddev, msg.value);
    }
    function _closeMarketInternal() internal {
        require(state == MarketState.Open, "Already closed");
        require(block.timestamp >= closeTime, "Too early to close");
        state = MarketState.Closed;
        emit MarketClosedV2();
    }
    function _requestPriceGetInternal(address chainlinkFeed, uint64 timeout, uint256 fee) internal {
        require(!priceRequested, "Price already requested");
        bytes memory key = abi.encodePacked(
            chainlinkFeed,
            bytes32(uint256(0))
        );
        bytes[] memory keys = new bytes[](1);
        keys[0] = key;
        uint64 height = 0;
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
        emit PriceRequestedV2(destination, key);
        emit FeeTokenSpentV2(address(this), fee);
    }
    function closeMarket() external onlyOwner {
        _closeMarketInternal();
    }
    function requestPriceGet(address chainlinkFeed, uint64 timeout, uint256 fee) external onlyOwner onlyClosed {
        _requestPriceGetInternal(chainlinkFeed, timeout, fee);
    }
    function onGetResponse(IncomingGetResponse memory incoming) external override {
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
        emit PriceReceivedV2(uint256(price));
        emit MarketResolvedV2(uint256(price));
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
                emit PayoutV2(t.user, uint256(payout), pnl);
            }
        }
    }
    // --- Required by IIsmpModule, but not used ---
    function onPostResponse(IncomingPostResponse memory) external override {}
    function onAccept(IncomingPostRequest memory) external override {}
    function onGetTimeout(GetRequest memory) external override {}
    function onPostRequestTimeout(PostRequest memory) external override {}
    function onPostResponseTimeout(PostResponse memory) external override {}
} 