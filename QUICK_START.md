# Quick Start: Campaign Creation

Get started with creating reward campaigns on Sonic in 5 minutes!

## Prerequisites

- Node.js 18+ and Yarn installed
- An encrypted wallet file with:
  - Reward tokens for the campaign
  - Native tokens (S) for gas fees

## Step 1: Install Dependencies

```bash
cd /path/to/smart-rewards-campaign-ops
yarn install
```

## Step 2: Prepare Your Wallet

**Good news!** The tool will automatically create a new encrypted wallet for you if one doesn't exist.

When you run the campaign creation command for the first time:
1. A new wallet will be generated automatically
2. It will be encrypted with your passphrase
3. Saved to `wallets/identity_smartrewards.json` (or your specified path)
4. You'll see the private key and mnemonic (save these securely!)

**Important**: 
- Never commit wallet files to version control!
- Save your private key and mnemonic in a secure location
- Fund the wallet with tokens before creating campaigns

## Step 3: Create Configuration File

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

### Configuration Fields Explained

- **poolAddress**: The liquidity pool you want to reward
- **rewardTokenAddress**: The ERC20 token used for rewards
- **escrowAmount**: Amount of tokens to lock (in token units, e.g., "5" = 5 tokens)
- **durationInDays**: How long the campaign runs (e.g., 7 = one week)
- **startDelayInHours**: Hours until campaign starts (minimum 1 hour)
- **execution_bundle**: IPFS hash of your campaign execution bundle

## Step 4: Create Your Campaign

### Option A: Using CLI (Recommended)

```bash
# Set your wallet passphrase as an environment variable
export WALLET_PASSPHRASE="your-secure-passphrase"

# Create the campaign
yarn create-campaign --config campaign-config.json
```

### Option B: Using Code

Create a file `my-campaign.ts`:

```typescript
import { createSonicCampaign } from 'smart-rewards-campaign-ops';

async function main() {
  const result = await createSonicCampaign(
    {
      identityFile: 'wallets/identity_smartrewards.json',
      passphrase: process.env.WALLET_PASSPHRASE!
    },
    {
      poolAddress: '0xYourPoolAddress',
      rewardTokenAddress: '0xYourRewardTokenAddress',
      escrowAmount: '5',
      durationInDays: 7,
      startDelayInHours: 1,
      metadata: {
        name: 'My Campaign',
        description: 'Campaign description',
        protocol: 'MyProtocol',
        category: 'Liquidity Boost',
        campaignType: 'token_balance_rewards',
        execution_bundle: 'QmYourIPFSHash'
      }
    }
  );

  console.log('Campaign created!');
  console.log('Transaction:', result.transactionHash);
  console.log('Campaign ID:', result.campaignId);
}

main();
```

Run it:

```bash
WALLET_PASSPHRASE=yourpass ts-node my-campaign.ts
```

## Step 5: Verify Your Campaign

After creation, you'll see output like:

```
✅ Campaign Created Successfully!

Transaction Details:
  Hash: 0x1234...
  Block: 12345678
  Gas Used: 234567
  Campaign ID: 42

Campaign Details:
  Start: 2025-12-11T10:00:00.000Z
  End: 2025-12-18T10:00:00.000Z
  Escrow: 5000000000000000000 wei
  IPFS Hash: QmWsy...
```

**Next Steps**:
1. Check the transaction on [Sonic Explorer](https://sonicscan.org)
2. Note your Campaign ID for future reference
3. Monitor campaign status
4. Users can start claiming rewards once active!

## Common Issues

### "Wallet not found"
- Check the path to your wallet file
- Ensure the file exists and is readable

### "Insufficient balance"
- Ensure you have enough reward tokens
- Ensure you have enough S tokens for gas

### "Invalid passphrase"
- Check that WALLET_PASSPHRASE is set correctly
- Verify the passphrase matches your wallet

### "Escrow amount below minimum"
- Increase the `escrowAmount` in your config
- Check the minimum requirement for your token

## Security Reminders

✅ **DO**:
- Use environment variables for passphrases
- Test on testnet first
- Keep wallet files secure (chmod 600)
- Use strong passphrases

❌ **DON'T**:
- Commit wallet files to git
- Share passphrases
- Use production wallets for testing
- Store passphrases in code

## Need Help?

- 📖 [Full Documentation](./CAMPAIGN_CREATION.md)
- 💡 [Examples](./examples/)
- 🐛 [Report Issues](https://github.com/SteerProtocol/smart-rewards/issues)

## What's Next?

After creating your campaign:

1. **Monitor**: Track campaign performance
2. **Manage**: Update or pause if needed
3. **Analyze**: Review reward distribution
4. **Iterate**: Create more campaigns!

---

**Happy Campaign Creating! 🚀**

