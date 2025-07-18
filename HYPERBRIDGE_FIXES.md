# Hyperbridge Integration Fixes

## Issues Found and Fixed

### 1. **Missing StateMachine Import**
**Issue**: The contract was trying to import `StateMachine.sol` from the wrong path.
**Fix**: Updated import to use the correct path: `@polytope-labs/ismp-solidity/interfaces/StateMachine.sol`

### 2. **Incorrect DispatchGet Structure**
**Issue**: The `requestPriceGet` function was using the wrong number of fields for `DispatchGet` struct.
**Fix**: Removed the incorrect `sender` field and used the correct 6-field structure:
- `dest`: Destination state machine
- `height`: Block height to read from
- `keys`: Storage keys to read
- `timeout`: Request timeout
- `fee`: Protocol fee
- `context`: Application-specific metadata

### 3. **Missing Fee Token Setup**
**Issue**: The contract didn't properly handle fee token approvals for Hyperbridge requests.
**Fix**: Created `scripts/requestPrice.js` that:
- Checks fee token balance
- Approves fee token for dispatcher
- Handles proper fee token setup before making requests

### 4. **Incorrect Destination Encoding**
**Issue**: The destination encoding in market creation was using a simple format instead of the proper StateMachine format.
**Fix**: Updated to use proper encoding: `abiCoder.encode(["uint8", "uint32"], [1, 11155111])` for EVM + Sepolia chainId.

### 5. **Improved Response Handling**
**Issue**: The manual resolve script wasn't properly mocking the Hyperbridge response format.
**Fix**: Updated `scripts/manualResolve.js` to:
- Use proper key encoding for Chainlink price feeds
- Mock the correct response structure
- Handle the proper storage value format

## New Scripts Created

### `scripts/requestPrice.js`
- Handles fee token setup and approval
- Requests price from Hyperbridge with proper parameters
- Includes error handling and balance checks

### `scripts/testHyperbridgeFlow.js`
- Comprehensive test of the full Hyperbridge integration flow
- Creates market, submits prediction, closes market, requests price, and resolves
- Demonstrates the complete end-to-end process

## Key Improvements

1. **Proper Hyperbridge Integration**: Now correctly follows the official Hyperbridge documentation
2. **Fee Token Management**: Proper handling of fee tokens for cross-chain requests
3. **Error Handling**: Better error handling and validation
4. **Testing**: Comprehensive test scripts for the full flow

## Usage

### Deploy and Test Full Flow
```bash
npx hardhat run scripts/testHyperbridgeFlow.js --network bscTestnet
```

### Request Price for Existing Market
```bash
MARKET_ADDRESS=0x... npx hardhat run scripts/requestPrice.js --network bscTestnet
```

### Manual Resolution (for testing)
```bash
MARKET_ADDRESS=0x... MOCK_PRICE=51500 npx hardhat run scripts/manualResolve.js --network bscTestnet
```

## Hyperbridge Configuration

The integration now properly uses:
- **BSC Testnet**: Source chain with dispatcher at `0x8Aa0Dea6D675d785A882967Bf38183f6117C09b7`
- **Sepolia**: Destination chain for Chainlink price feeds
- **Fee Token**: USD.h token for protocol fees
- **Timeout**: 1 hour for price requests

## Next Steps

1. **Deploy to Testnet**: Use the updated scripts to deploy and test on BSC testnet
2. **Test Real Hyperbridge Flow**: Test with actual cross-chain price requests
3. **Frontend Integration**: Update frontend to handle the new market creation parameters
4. **Production Deployment**: Deploy to mainnet with proper fee token setup

## References

- [Hyperbridge Dispatching Documentation](https://docs.hyperbridge.network/developers/evm/dispatching#get-requests)
- [Hyperbridge Testnet Contract Addresses](https://docs.hyperbridge.network/developers/evm/contracts/testnet)
- [Hyperbridge SDK](https://github.com/polytope-labs/hyperbridge-sdk/tree/main) 