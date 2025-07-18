// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Weighted Gaussian Distribution Market AMM
/// @notice Implements a continuous-outcome prediction market using weighted Gaussian updates
contract DistributionMarket {
    struct Gaussian {
        int256 mu;       // mean
        uint256 sigma;   // std deviation (must be > 0)
        uint256 weight;  // capital contributed
    }

    Gaussian public market;
    uint256 public totalWeight;     // Total capital-weighted contribution
    uint256 public backingCollateral;  // Total USD backing
    bool public resolved;
    int256 public resolvedOutcome;

    mapping(address => Gaussian) public traderBeliefs;
    mapping(address => uint256) public traderCollateral;

    event Initialized(int256 mu, uint256 sigma, uint256 weight);
    event BeliefUpdated(address indexed trader, int256 mu, uint256 sigma, uint256 capital);
    event MarketResolved(int256 outcome);
    event Claimed(address indexed trader, uint256 payout);

    modifier notResolved() {
        require(!resolved, "Market already resolved");
        _;
    }

    function initialize(int256 _mu, uint256 _sigma, uint256 _collateral) external {
        require(totalWeight == 0, "Already initialized");
        require(_sigma > 0, "sigma must be positive");

        market = Gaussian({ mu: _mu, sigma: _sigma, weight: _collateral });
        totalWeight = _collateral;
        backingCollateral = _collateral;
        traderBeliefs[msg.sender] = market;
        traderCollateral[msg.sender] = _collateral;

        emit Initialized(_mu, _sigma, _collateral);
    }

    function submitBelief(int256 _mu, uint256 _sigma) external payable notResolved {
        require(msg.value > 0, "Collateral required");
        require(_sigma > 0, "sigma must be positive");

        // Update market weighted average
        uint256 newWeight = totalWeight + msg.value;

        int256 updatedMu = int256((uint256(market.mu) * market.weight + uint256(_mu) * msg.value) / newWeight);
        uint256 updatedSigma = (market.sigma * market.weight + _sigma * msg.value) / newWeight;

        market = Gaussian({ mu: updatedMu, sigma: updatedSigma, weight: newWeight });
        totalWeight = newWeight;
        backingCollateral += msg.value;

        // Save trader belief and collateral
        traderBeliefs[msg.sender] = Gaussian({ mu: _mu, sigma: _sigma, weight: msg.value });
        traderCollateral[msg.sender] += msg.value;

        emit BeliefUpdated(msg.sender, _mu, _sigma, msg.value);
    }

    function resolveMarket(int256 outcome) external notResolved {
        resolved = true;
        resolvedOutcome = outcome;
        emit MarketResolved(outcome);
    }

    function claim() external {
        require(resolved, "Market not yet resolved");
        require(traderCollateral[msg.sender] > 0, "No position");

        Gaussian memory belief = traderBeliefs[msg.sender];

        // Compute payout = belief(x*) * weight / peak_value
        // Normal PDF peak = 1 / (sqrt(2pi) * sigma)
        // Scale payout to collateral proportion

        uint256 scale = 3989422804e9; // approximate 1/sqrt(2*pi) * 1e18
        uint256 denominator = belief.sigma * 1e18;

        uint256 peak = scale / denominator; // in 1e9 units

        // Compute e^{-(x - mu)^2 / (2 * sigma^2)}
        int256 diff = resolvedOutcome - belief.mu;
        uint256 exponent = uint256((diff * diff) * 1e18 / int256(2 * belief.sigma * belief.sigma));
        uint256 value = peak * expNeg(exponent) / 1e18;

        // payout = relative value * contributed collateral
        uint256 payout = value * belief.weight / peak;

        // Avoid overpaying
        if (payout > traderCollateral[msg.sender]) {
            payout = traderCollateral[msg.sender];
        }

        traderCollateral[msg.sender] = 0;
        payable(msg.sender).transfer(payout);

        emit Claimed(msg.sender, payout);
    }

    // Approximate e^{-x} for x in [0, 100] using Taylor expansion
    function expNeg(uint256 x) internal pure returns (uint256) {
        // e^{-x} ≈ 1 - x + x^2/2! - x^3/3! + x^4/4! ... (limited terms)
        // x is scaled by 1e18
        uint256 term = 1e18;
        uint256 result = term;

        term = (term * x) / 1e18; result -= term; // x
        term = (term * x) / 1e18 / 2; result += term; // x^2/2
        term = (term * x) / 1e18 / 3; result -= term; // x^3/6
        term = (term * x) / 1e18 / 4; result += term; // x^4/24
        term = (term * x) / 1e18 / 5; result -= term; // x^5/120

        return result;
    }

    function getMarketBelief() external view returns (int256, uint256) {
        return (market.mu, market.sigma);
    }

    function getCollateralVault() external view returns (uint256) {
        return address(this).balance;
    }
}
