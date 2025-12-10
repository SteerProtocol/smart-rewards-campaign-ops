# Campaign Creation Guide

This guide explains how to create reward campaigns on Sonic and other EVM-compatible blockchains using the Smart Rewards Campaign Operations toolkit.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)

## Overview

The campaign creation module allows you to:

- Create timestamp-based reward campaigns on Sonic (Chain ID: 146) and other EVM chains
- Manage encrypted wallets securely
- Handle token approvals automatically
- Upload campaign metadata to IPFS
- Track campaign creation with detailed transaction receipts

## Prerequisites

Before creating a campaign, ensure you have:

1. **Node.js**: Version 18.0.0 or higher
2. **Yarn**: Version 1.22.0 or higher
3. **Wallet**: The tool will auto-create an encrypted wallet if you don't have one
4. **Reward Tokens**: Enough tokens to escrow for the campaign (fund your wallet after creation)
5. **Native Tokens**: For gas fees (e.g., S tokens on Sonic)

## Quick Start

### 1. Install Dependencies

```bash
yarn install
```

### 2. Create a Configuration File

Copy the example configuration:

```bash
cp campaign-config.example.json campaign-config.json
```

Edit `campaign-config.json` with your campaign details:

```json
{
  "wallet": {
    "identityFile": "wallets/identity_smartrewards.json",
    "passphrase": "your-secure-passphrase"
  },
  "chain": {
    "chainId": 146,
    "rpcUrl": "https://rpc.soniclabs.com",
    "smartRewardsAddress": "0x3966b5B8AD4BEf3Be7d391d36d7202B3CB0D0C3f",
    "useLegacyTx": true
  },
  "campaign": {
    "poolAddress": "0xYourPoolAddress",
    "rewardTokenAddress": "0xYourRewardTokenAddress",
    "escrowAmount": "5",
    "durationInDays": 7,
    "startDelayInHours": 1,
    "metadata": {
      "name": "Your Campaign Name",
      "description": "Campaign description",
      "protocol": "YourProtocol",
      "category": "Liquidity Boost",
      "campaignType": "token_balance_rewards",
      "execution_bundle": "QmYourIPFSHash"
    }
  }
}
```

### 3. Create the Campaign

```bash
yarn create-campaign --config campaign-config.json
```

Or use environment variables for sensitive data:

```bash
WALLET_PASSPHRASE=mypass yarn create-campaign --config campaign-config.json
```

## Configuration

### Wallet Configuration

```typescript
{
  "identityFile": string,  // Path to encrypted wallet JSON file
  "passphrase": string     // Wallet decryption passphrase
}
```

**Security Best Practices:**
- Never commit wallet files or passphrases to version control
- Use environment variables for passphrases in production
- Store wallet files in a secure location with restricted permissions

### Chain Configuration

```typescript
{
  "chainId": number,              // Blockchain network ID (e.g., 146 for Sonic)
  "rpcUrl": string,               // RPC endpoint URL
  "smartRewardsAddress": string,  // SmartRewards contract address
  "useLegacyTx": boolean         // Use legacy transaction type (required for Sonic)
}
```

**Supported Networks:**
- **Sonic**: Chain ID 146, RPC: `https://rpc.soniclabs.com`
- **Ethereum**: Chain ID 1, RPC: `https://eth.llamarpc.com`
- **Other EVM chains**: Configure accordingly

### Campaign Configuration

```typescript
{
  "poolAddress": string,          // Liquidity pool address to reward
  "rewardTokenAddress": string,   // ERC20 token used for rewards
  "escrowAmount": string,         // Amount of tokens to escrow (in token units)
  "durationInDays": number,       // Campaign duration in days
  "startDelayInHours": number,    // Hours until campaign starts (min 1 hour)
  "metadata": {
    "name": string,               // Campaign name
    "description": string,        // Campaign description
    "protocol": string,           // Protocol name
    "category": string,           // Campaign category
    "campaignType": string,       // Type: "token_balance_rewards" or "liquidity_provision_rewards"
    "execution_bundle": string    // IPFS hash of execution bundle
  }
}
```

## Usage

### CLI Usage

#### Basic Usage

```bash
# Use default configuration
yarn create-campaign

# Use custom configuration file
yarn create-campaign --config ./my-campaign.json

# Display help
yarn create-campaign --help
```

#### With Environment Variables

```bash
# Override passphrase
WALLET_PASSPHRASE=mypass yarn create-campaign --config config.json

# Override RPC URL
RPC_URL=https://custom-rpc.com yarn create-campaign --config config.json

# Override both
WALLET_PASSPHRASE=mypass RPC_URL=https://custom-rpc.com yarn create-campaign
```

### Programmatic Usage

```typescript
import { CampaignCreator, createSonicCampaign } from 'smart-rewards-campaign-ops';

// Method 1: Using the convenience function
const result = await createSonicCampaign(
  {
    identityFile: 'wallets/identity.json',
    passphrase: 'your-passphrase'
  },
  {
    poolAddress: '0x...',
    rewardTokenAddress: '0x...',
    escrowAmount: '5',
    durationInDays: 7,
    startDelayInHours: 1,
    metadata: {
      name: 'My Campaign',
      description: 'Campaign description',
      protocol: 'MyProtocol',
      category: 'Liquidity Boost',
      campaignType: 'token_balance_rewards',
      execution_bundle: 'QmHash'
    }
  }
);

console.log('Campaign created:', result.transactionHash);

// Method 2: Using the CampaignCreator class
const creator = new CampaignCreator({
  chainId: 146,
  rpcUrl: 'https://rpc.soniclabs.com',
  smartRewardsAddress: '0x3966b5B8AD4BEf3Be7d391d36d7202B3CB0D0C3f',
  useLegacyTx: true
});

await creator.loadWallet({
  identityFile: 'wallets/identity.json',
  passphrase: 'your-passphrase'
});

const result = await creator.createCampaign({
  poolAddress: '0x...',
  rewardTokenAddress: '0x...',
  escrowAmount: '5',
  durationInDays: 7,
  startDelayInHours: 1,
  metadata: { /* ... */ }
});
```

## API Reference

### CampaignCreator Class

#### Constructor

```typescript
constructor(config: CampaignCreationConfig)
```

Creates a new campaign creator instance.

#### Methods

##### `loadWallet(walletConfig: WalletConfig): Promise<void>`

Loads and decrypts the wallet from an encrypted JSON file. If the wallet file doesn't exist, automatically creates a new encrypted wallet with the provided passphrase and saves it to the specified location.

**New Wallet Creation:**
- Generates a new random wallet
- Encrypts it with the provided passphrase
- Creates directories if needed
- Displays private key and mnemonic (save these!)
- Saves encrypted wallet to specified file

##### `approveTokens(rewardTokenAddress: string, amount: bigint): Promise<ContractTransactionReceipt>`

Approves the SmartRewards contract to spend reward tokens.

##### `calculateCampaignTiming(startDelayInHours: number, durationInDays: number): Promise<{startTimestamp: number, endTimestamp: number}>`

Calculates campaign start and end timestamps based on current blockchain time.

##### `createCampaign(campaignParams): Promise<CampaignCreationResult>`

Creates a reward campaign on the blockchain.

**Parameters:**
- `poolAddress`: Liquidity pool address
- `rewardTokenAddress`: Reward token address
- `escrowAmount`: Amount to escrow (in token units)
- `durationInDays`: Campaign duration
- `startDelayInHours`: Hours until start
- `metadata`: Campaign metadata

**Returns:**
```typescript
{
  transactionHash: string;
  blockNumber: number;
  gasUsed: string;
  campaignId?: string;
  startTimestamp: number;
  endTimestamp: number;
  escrowAmount: string;
  ipfsHash: string;
}
```

### Convenience Functions

#### `createSonicCampaign(walletConfig, campaignConfig, options?)`

Quick function to create a campaign on Sonic with default settings.

## Examples

### Example 1: Basic Sonic Campaign

```typescript
import { createSonicCampaign } from 'smart-rewards-campaign-ops';

const result = await createSonicCampaign(
  {
    identityFile: 'wallets/identity.json',
    passphrase: process.env.WALLET_PASSPHRASE!
  },
  {
    poolAddress: '0xb1bc4b830fcba2184b92e15b9133c41160518038',
    rewardTokenAddress: '0xddF26B42C1d903De8962d3F79a74a501420d5F19',
    escrowAmount: '5',
    durationInDays: 7,
    startDelayInHours: 1,
    metadata: {
      name: 'Boost liquidity',
      description: 'Increase liquidity in vault',
      protocol: 'ThickV2',
      category: 'Liquidity Boost',
      campaignType: 'token_balance_rewards',
      execution_bundle: 'QmWsyDNFPNXDDreLMtHjf4bcywKDP5aXJ8aKDxWsj6ccHR'
    }
  }
);

console.log(`Campaign created: ${result.transactionHash}`);
console.log(`Campaign ID: ${result.campaignId}`);
```

### Example 2: Custom Chain Campaign

```typescript
import { CampaignCreator } from 'smart-rewards-campaign-ops';

const creator = new CampaignCreator({
  chainId: 1, // Ethereum mainnet
  rpcUrl: 'https://eth.llamarpc.com',
  smartRewardsAddress: '0xYourContractAddress',
  useLegacyTx: false
});

await creator.loadWallet({
  identityFile: 'wallets/eth-wallet.json',
  passphrase: process.env.WALLET_PASSPHRASE!
});

const result = await creator.createCampaign({
  poolAddress: '0x...',
  rewardTokenAddress: '0x...',
  escrowAmount: '100',
  durationInDays: 30,
  startDelayInHours: 24,
  metadata: {
    name: 'Long-term Liquidity Campaign',
    description: 'Reward long-term liquidity providers',
    protocol: 'MyDeFiProtocol',
    category: 'Liquidity Mining',
    campaignType: 'liquidity_provision_rewards',
    execution_bundle: 'QmYourIPFSHash'
  }
});
```

### Example 3: CLI with Config File

Create `my-campaign.json`:

```json
{
  "wallet": {
    "identityFile": "wallets/identity.json",
    "passphrase": "my-secure-passphrase"
  },
  "chain": {
    "chainId": 146,
    "rpcUrl": "https://rpc.soniclabs.com",
    "smartRewardsAddress": "0x3966b5B8AD4BEf3Be7d391d36d7202B3CB0D0C3f",
    "useLegacyTx": true
  },
  "campaign": {
    "poolAddress": "0xYourPool",
    "rewardTokenAddress": "0xYourToken",
    "escrowAmount": "10",
    "durationInDays": 14,
    "startDelayInHours": 2,
    "metadata": {
      "name": "Two Week Campaign",
      "description": "Boost liquidity for 2 weeks",
      "protocol": "MyProtocol",
      "category": "Liquidity Boost",
      "campaignType": "token_balance_rewards",
      "execution_bundle": "QmHash"
    }
  }
}
```

Run:

```bash
yarn create-campaign --config my-campaign.json
```

## Troubleshooting

### Common Issues

#### 1. "Wallet not loaded" Error

**Cause**: Wallet wasn't loaded before calling `createCampaign()`

**Solution**: Call `loadWallet()` first:

```typescript
await creator.loadWallet(walletConfig);
```

#### 2. "Insufficient allowance" Error

**Cause**: Token approval failed or wasn't sufficient

**Solution**: The module handles this automatically. If it persists, check:
- You have enough tokens in your wallet
- The token contract is valid
- Gas fees are sufficient

#### 3. "Escrow amount less than minimum" Error

**Cause**: Your escrow amount is below the minimum required by the contract

**Solution**: Increase the `escrowAmount` in your configuration

#### 4. "Failed to load wallet" Error

**Cause**: Incorrect passphrase or corrupted wallet file

**Solution**:
- Verify the passphrase is correct
- Check the wallet file path
- Ensure the wallet file is valid JSON

#### 5. Transaction Fails with "Out of Gas"

**Cause**: Insufficient gas limit

**Solution**: The module automatically adds a 2x buffer. If it still fails:
- Ensure you have enough native tokens for gas
- Check network congestion

### Debug Mode

Enable detailed logging:

```typescript
// Set environment variable
process.env.DEBUG = 'smart-rewards:*';

// Or add console.log statements in your code
```

### Getting Help

If you encounter issues:

1. Check the [GitHub Issues](https://github.com/SteerProtocol/smart-rewards/issues)
2. Review the transaction on a block explorer
3. Verify your configuration matches the examples
4. Ensure all prerequisites are met

## Security Considerations

1. **Never commit sensitive data**:
   - Wallet files
   - Passphrases
   - Private keys
   - Configuration files with secrets

2. **Use environment variables** for sensitive data in production

3. **Secure wallet files** with appropriate file permissions:
   ```bash
   chmod 600 wallets/identity.json
   ```

4. **Test on testnets** before deploying to mainnet

5. **Verify contract addresses** before sending transactions

## Additional Resources

- [Smart Rewards Documentation](https://github.com/SteerProtocol/smart-rewards)
- [Sonic Network Documentation](https://docs.soniclabs.com)
- [Ethers.js Documentation](https://docs.ethers.org)

## License

MIT License - See LICENSE file for details

