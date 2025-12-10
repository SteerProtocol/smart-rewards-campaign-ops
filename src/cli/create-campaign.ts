#!/usr/bin/env node
/**
 * Campaign Creation CLI
 * 
 * This CLI tool allows you to create reward campaigns on Sonic and other EVM chains.
 * 
 * Usage:
 *   yarn create-campaign          # Interactive mode (default)
 *   yarn create-campaign --config ./config.json  # Use config file
 * 
 * Configuration file format (JSON):
 * {
 *   "wallet": {
 *     "identityFile": "wallets/identity.json",
 *     "passphrase": "your-passphrase"
 *   },
 *   "chain": {
 *     "chainId": 146,
 *     "rpcUrl": "https://rpc.soniclabs.com",
 *     "smartRewardsAddress": "0x3966b5B8AD4BEf3Be7d391d36d7202B3CB0D0C3f"
 *   },
 *   "campaign": {
 *     "poolAddress": "0x...",
 *     "rewardTokenAddress": "0x...",
 *     "escrowAmount": "5",
 *     "durationInDays": 7,
 *     "startDelayInHours": 1,
 *     "executionBundle": "QmWsyDNFPNXDDreLMtHjf4bcywKDP5aXJ8aKDxWsj6ccHR",
 *     "metadata": {
 *       "name": "Boost liquidity",
 *       "description": "Increase liquidity...",
 *       "protocol": "ThickV2",
 *       "category": "Liquidity Boost",
 *       "campaignType": "token_balance_rewards"
 *     }
 *   }
 * }
 */

import { CampaignCreator } from '../blockchain/campaign-creation';
import { 
  CampaignCreationConfig, 
  WalletConfig, 
  CampaignMetadata 
} from '../types';
import fs from 'fs';
import path from 'path';

// ============================================================================
// DEFAULT CONFIGURATION - SONIC CHAIN
// ============================================================================

const DEFAULT_SONIC_CONFIG: CampaignCreationConfig = {
  chainId: 146,
  rpcUrl: 'https://rpc.soniclabs.com',
  smartRewardsAddress: '0x3966b5B8AD4BEf3Be7d391d36d7202B3CB0D0C3f',
  useLegacyTx: true
};

const DEFAULT_WALLET_CONFIG: WalletConfig = {
  identityFile: 'wallets/identity_smartrewards.json',
  passphrase: '135892' // CHANGE THIS IN PRODUCTION
};

const DEFAULT_CAMPAIGN_CONFIG = {
  poolAddress: '0xb1bc4b830fcba2184b92e15b9133c41160518038',
  rewardTokenAddress: '0xddF26B42C1d903De8962d3F79a74a501420d5F19',
  escrowAmount: '5',
  durationInDays: 7,
  startDelayInHours: 1,
  metadata: {
    name: 'Boost liquidity',
    description: 'Increase liquidity in a specific vault to improve market depth and reduce slippage.',
    protocol: 'ThickV2',
    category: 'Liquidity Boost',
    campaignType: 'token_balance_rewards',
    execution_bundle: 'QmWsyDNFPNXDDreLMtHjf4bcywKDP5aXJ8aKDxWsj6ccHR'
  } as CampaignMetadata
};

// ============================================================================
// CLI FUNCTIONS
// ============================================================================

/**
 * Load configuration from a JSON file
 */
function loadConfigFromFile(configPath: string): any {
  try {
    const fullPath = path.resolve(process.cwd(), configPath);
    const configData = fs.readFileSync(fullPath, 'utf-8');
    return JSON.parse(configData);
  } catch (error) {
    console.error(`❌ Failed to load config file: ${configPath}`);
    console.error(`   ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

/**
 * Display help information
 */
function displayHelp(): void {
  console.log(`
🚀 Smart Rewards Campaign Creator

Usage:
  yarn create-campaign                    Create campaign with default config
  yarn create-campaign --config <path>    Create campaign with config file
  yarn create-campaign --help             Display this help message

Default Configuration:
  Chain: Sonic (Chain ID: 146)
  RPC: https://rpc.soniclabs.com
  SmartRewards: 0x3966b5B8AD4BEf3Be7d391d36d7202B3CB0D0C3f

Config File Format: (JSON)
{
  "wallet": {
    "identityFile": "wallets/identity.json",
    "passphrase": "your-passphrase"
  },
  "chain": {
    "chainId": 146,
    "rpcUrl": "https://rpc.soniclabs.com",
    "smartRewardsAddress": "0x..."
  },
  "campaign": {
    "poolAddress": "0x...",
    "rewardTokenAddress": "0x...",
    "escrowAmount": "5",
    "durationInDays": 7,
    "startDelayInHours": 1,
    "metadata": {
      "name": "Campaign Name",
      "description": "Campaign Description",
      "protocol": "Protocol Name",
      "category": "Liquidity Boost",
      "campaignType": "token_balance_rewards",
      "execution_bundle": "QmWsy..."
    }
  }
}

Environment Variables:
  WALLET_PASSPHRASE    Wallet passphrase (overrides config)
  RPC_URL              RPC endpoint (overrides config)

Examples:
  # Create campaign with default settings
  yarn create-campaign

  # Create campaign with custom config
  yarn create-campaign --config ./my-campaign.json

  # Use environment variables
  WALLET_PASSPHRASE=mypass yarn create-campaign
`);
}

/**
 * Main CLI execution function
 */
async function main(): Promise<void> {
  try {
    const args = process.argv.slice(2);

    // Check for help flag
    if (args.includes('--help') || args.includes('-h')) {
      displayHelp();
      process.exit(0);
    }

    // Load configuration
    let walletConfig = { ...DEFAULT_WALLET_CONFIG };
    let chainConfig = { ...DEFAULT_SONIC_CONFIG };
    let campaignConfig = { ...DEFAULT_CAMPAIGN_CONFIG };

    // Check for config file
    const configIndex = args.indexOf('--config');
    if (configIndex !== -1 && args[configIndex + 1]) {
      const configPath = args[configIndex + 1];
      console.log(`📄 Loading configuration from: ${configPath}`);
      const fileConfig = loadConfigFromFile(configPath);

      if (fileConfig.wallet) {
        walletConfig = { ...walletConfig, ...fileConfig.wallet };
      }
      if (fileConfig.chain) {
        chainConfig = { ...chainConfig, ...fileConfig.chain };
      }
      if (fileConfig.campaign) {
        campaignConfig = { ...campaignConfig, ...fileConfig.campaign };
      }
    } else {
      console.log('📄 Using default configuration');
      console.log('   Use --config <path> to specify a custom config file');
      console.log('   Use --help to see configuration options\n');
    }

    // Override with environment variables
    if (process.env.WALLET_PASSPHRASE) {
      walletConfig.passphrase = process.env.WALLET_PASSPHRASE;
      console.log('✓ Using WALLET_PASSPHRASE from environment');
    }
    if (process.env.RPC_URL) {
      chainConfig.rpcUrl = process.env.RPC_URL;
      console.log('✓ Using RPC_URL from environment');
    }

    // Display configuration summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 Configuration Summary');
    console.log('='.repeat(60));
    console.log(`Chain ID: ${chainConfig.chainId}`);
    console.log(`RPC URL: ${chainConfig.rpcUrl}`);
    console.log(`SmartRewards: ${chainConfig.smartRewardsAddress}`);
    console.log(`Wallet File: ${walletConfig.identityFile}`);
    console.log(`Pool Address: ${campaignConfig.poolAddress}`);
    console.log(`Reward Token: ${campaignConfig.rewardTokenAddress}`);
    console.log(`Escrow Amount: ${campaignConfig.escrowAmount} tokens`);
    console.log(`Duration: ${campaignConfig.durationInDays} days`);
    console.log(`Start Delay: ${campaignConfig.startDelayInHours} hours`);
    console.log('='.repeat(60) + '\n');

    // Create campaign
    const creator = new CampaignCreator(chainConfig);
    await creator.loadWallet(walletConfig);

    const result = await creator.createCampaign({
      poolAddress: campaignConfig.poolAddress,
      rewardTokenAddress: campaignConfig.rewardTokenAddress,
      escrowAmount: campaignConfig.escrowAmount,
      durationInDays: campaignConfig.durationInDays,
      startDelayInHours: campaignConfig.startDelayInHours,
      metadata: campaignConfig.metadata
    });

    // Display results
    console.log('\n' + '='.repeat(60));
    console.log('📊 Campaign Creation Summary');
    console.log('='.repeat(60));
    console.log(`✅ Status: Success`);
    console.log(`📝 Transaction Hash: ${result.transactionHash}`);
    console.log(`🔢 Block Number: ${result.blockNumber}`);
    console.log(`⛽ Gas Used: ${result.gasUsed}`);
    if (result.campaignId) {
      console.log(`🎯 Campaign ID: ${result.campaignId}`);
    }
    console.log(`📅 Start: ${new Date(result.startTimestamp * 1000).toISOString()}`);
    console.log(`📅 End: ${new Date(result.endTimestamp * 1000).toISOString()}`);
    console.log(`💰 Escrow: ${result.escrowAmount} wei`);
    console.log(`📦 IPFS Hash: ${result.ipfsHash}`);
    console.log('='.repeat(60) + '\n');

    console.log('✅ Campaign created successfully!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Campaign creation failed:');
    console.error(`   ${error instanceof Error ? error.message : 'Unknown error'}`);
    if (error instanceof Error && error.stack) {
      console.error('\n Stack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Execute CLI
if (require.main === module) {
  main();
}

export { main as createCampaignCLI };

