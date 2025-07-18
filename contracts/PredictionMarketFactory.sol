// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./PredictionMarket.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract PredictionMarketFactory is Ownable {
    address public feeToken; // USD.h address
    uint256 public constant INITIAL_FEE_AMOUNT = 10 * 1e18; // 10 USD.h (assuming 18 decimals)

    event MarketCreated(address indexed market, string prompt, string asset, uint256 closeTime);

    // The constructor now only takes admin and feeToken addresses
    constructor(address admin, address _feeToken) Ownable(admin) {
        feeToken = _feeToken;
    }

    // Allow the owner to fund the factory with USD.h after deployment
    function fundFactory(uint256 amount) external onlyOwner {
        require(IERC20(feeToken).transferFrom(msg.sender, address(this), amount), "USD.h funding transfer failed");
    }

    function createMarket(
        string memory prompt,
        string memory asset,
        uint256 closeTime,
        address dispatcher,
        bytes memory destination,
        uint256 initialMean,
        uint256 initialStddev
    ) external onlyOwner returns (address) {
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
        // Fund the market with 10 USD.h
        require(IERC20(feeToken).transfer(address(market), INITIAL_FEE_AMOUNT), "Fee token transfer failed");
        emit MarketCreated(address(market), prompt, asset, closeTime);
        return address(market);
    }
} 