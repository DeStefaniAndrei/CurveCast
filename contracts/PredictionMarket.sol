// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

contract PredictionMarket is Ownable {
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

    event PredictionSubmitted(address indexed user, uint256 mean, uint256 stddev, uint256 stake);
    event MarketClosed();
    event MarketResolved(uint256 outcome);

    modifier onlyOpen() {
        require(state == MarketState.Open, "Market not open");
        require(block.timestamp < closeTime, "Market closed by time");
        _;
    }

    modifier onlyClosed() {
        require(state == MarketState.Closed, "Market not closed");
        _;
    }

    constructor(string memory _prompt, string memory _asset, uint256 _closeTime, address admin) {
        prompt = _prompt;
        asset = _asset;
        closeTime = _closeTime;
        state = MarketState.Open;
        _transferOwnership(admin);
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

    function resolveMarket(uint256 _outcome) external onlyOwner onlyClosed {
        outcome = _outcome;
        state = MarketState.Resolved;
        emit MarketResolved(_outcome);
        // Payout logic to be implemented
    }

    function getPredictions() external view returns (Prediction[] memory) {
        return predictions;
    }
} 