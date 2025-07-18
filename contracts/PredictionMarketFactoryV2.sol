// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./PredictionMarketV2.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract PredictionMarketFactoryV2 is Ownable {
    string public constant VERSION = "V2";
    address public feeToken;
    uint256 public constant INITIAL_FEE_AMOUNT = 10 * 1e18;
    event MarketCreatedV2(address indexed market, string prompt, string asset, uint256 closeTime);
    constructor(address admin, address _feeToken) Ownable(admin) {
        feeToken = _feeToken;
    }
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
        PredictionMarketV2 market = new PredictionMarketV2(
            prompt,
            asset,
            closeTime,
            owner(),
            dispatcher,
            destination,
            initialMean,
            initialStddev
        );
        require(IERC20(feeToken).transfer(address(market), INITIAL_FEE_AMOUNT), "Fee token transfer failed");
        emit MarketCreatedV2(address(market), prompt, asset, closeTime);
        return address(market);
    }
} 