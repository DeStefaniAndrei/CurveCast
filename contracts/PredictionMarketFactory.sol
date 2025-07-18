// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./PredictionMarket.sol";

contract PredictionMarketFactory is Ownable {
    address[] public markets;

    event MarketCreated(address indexed market, string prompt, string asset, uint256 closeTime);

    constructor(address admin) Ownable(admin) {}

    function createMarket(
        string memory prompt,
        string memory asset,
        uint256 closeTime,
        address dispatcher,
        bytes memory destination,
        uint256 initialMean,
        uint256 initialStddev
    ) external onlyOwner {
        PredictionMarket market = new PredictionMarket(
            prompt,
            asset,
            closeTime,
            owner(),
            dispatcher,
            destination,
            initialMean,
            initialStddev
        );
        markets.push(address(market));
        emit MarketCreated(address(market), prompt, asset, closeTime);
    }

    function getMarkets() external view returns (address[] memory) {
        return markets;
    }
} 