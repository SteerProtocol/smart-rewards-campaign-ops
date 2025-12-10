# Examples

This directory contains example scripts demonstrating how to use the Smart Rewards Campaign Operations toolkit.

## Available Examples

### 1. Create Sonic Campaign

**File**: `create-sonic-campaign.ts`

Demonstrates how to create a reward campaign on the Sonic blockchain.

**Prerequisites**:
- Encrypted wallet file at `wallets/identity_smartrewards.json`
- Sufficient reward tokens in the wallet
- Native tokens (S) for gas fees
- WALLET_PASSPHRASE environment variable set

**Run**:
```bash
WALLET_PASSPHRASE=yourpass ts-node examples/create-sonic-campaign.ts
```

**What it does**:
1. Loads and decrypts your wallet
2. Checks token balances
3. Approves the SmartRewards contract to spend tokens
4. Calculates campaign timing
5. Creates the campaign on-chain
6. Returns transaction details and campaign ID

## Configuration

Before running examples, you need to:

1. **Create a wallet file** (if you don't have one):
   ```bash
   # Using ethers.js CLI or similar tool
   # The wallet should be encrypted with a passphrase
   ```

2. **Set environment variables**:
   ```bash
   export WALLET_PASSPHRASE="your-secure-passphrase"
   export RPC_URL="https://rpc.soniclabs.com"  # Optional
   ```

3. **Update configuration** in the example file:
   - Pool address
   - Reward token address
   - Escrow amount
   - Campaign duration
   - Metadata

## Security Notes

⚠️ **IMPORTANT**: Never commit:
- Wallet files
- Passphrases
- Private keys
- Configuration files with real addresses/tokens

Always use:
- Environment variables for sensitive data
- Test networks before mainnet
- Small amounts for testing

## Common Issues

### "Wallet not found"
- Ensure the wallet file exists at the specified path
- Check file permissions (should be readable)

### "Insufficient balance"
- Ensure you have enough reward tokens
- Ensure you have enough native tokens for gas

### "Invalid passphrase"
- Check that WALLET_PASSPHRASE is set correctly
- Verify the passphrase matches the one used to encrypt the wallet

### "Transaction failed"
- Check gas limits
- Verify token addresses are correct
- Ensure minimum escrow amount is met

## Next Steps

After running the examples:

1. Check the transaction on a block explorer
2. Note the campaign ID for future reference
3. Monitor the campaign status
4. Users can start claiming rewards once the campaign is active

## Additional Resources

- [Campaign Creation Guide](../CAMPAIGN_CREATION.md)
- [Main README](../README.md)
- [Sonic Documentation](https://docs.soniclabs.com)

