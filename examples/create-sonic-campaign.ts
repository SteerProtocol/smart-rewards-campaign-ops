/**
 * Example: Create a Campaign on Sonic
 * 
 * This example demonstrates how to create a reward campaign on the Sonic blockchain.
 * 
 * Before running:
 * 1. Copy campaign-config.example.json to campaign-config.json
 * 2. Update the configuration with your values
 * 3. Ensure you have an encrypted wallet file
 * 4. Set WALLET_PASSPHRASE environment variable
 * 
 * Run:
 *   WALLET_PASSPHRASE=yourpass ts-node examples/create-sonic-campaign.ts
 */

import { createSonicCampaign } from '../src/blockchain/campaign-creation';

async function main() {
  try {
    console.log('🚀 Creating Sonic Campaign Example\n');

    // Configuration
    const walletConfig = {
      identityFile: 'wallets/identity_smartrewards.json',
      passphrase: process.env.WALLET_PASSPHRASE || 'default-passphrase'
    };

    const campaignConfig = {
      // Liquidity pool to reward
      poolAddress: '0xb1bc4b830fcba2184b92e15b9133c41160518038',
      
      // Reward token (ERC20)
      rewardTokenAddress: '0xddF26B42C1d903De8962d3F79a74a501420d5F19',
      
      // Amount of tokens to escrow (in token units, not wei)
      escrowAmount: '5',
      
      // Campaign duration
      durationInDays: 7,
      
      // Hours until campaign starts (minimum 1 hour recommended)
      startDelayInHours: 1,
      
      // Campaign metadata
      metadata: {
        name: 'Boost liquidity',
        description: 'Increase liquidity in a specific vault to improve market depth and reduce slippage.',
        protocol: 'ThickV2',
        category: 'Liquidity Boost',
        campaignType: 'token_balance_rewards',
        execution_bundle: 'QmWsyDNFPNXDDreLMtHjf4bcywKDP5aXJ8aKDxWsj6ccHR'
      }
    };

    // Optional: Override RPC URL or SmartRewards address
    const options = {
      rpcUrl: process.env.RPC_URL || 'https://rpc.soniclabs.com',
      smartRewardsAddress: '0x3966b5B8AD4BEf3Be7d391d36d7202B3CB0D0C3f'
    };

    // Create the campaign
    const result = await createSonicCampaign(
      walletConfig,
      campaignConfig,
      options
    );

    // Display results
    console.log('\n✅ Campaign Created Successfully!\n');
    console.log('Transaction Details:');
    console.log('  Hash:', result.transactionHash);
    console.log('  Block:', result.blockNumber);
    console.log('  Gas Used:', result.gasUsed);
    
    if (result.campaignId) {
      console.log('  Campaign ID:', result.campaignId);
    }
    
    console.log('\nCampaign Details:');
    console.log('  Start:', new Date(result.startTimestamp * 1000).toISOString());
    console.log('  End:', new Date(result.endTimestamp * 1000).toISOString());
    console.log('  Escrow:', result.escrowAmount, 'wei');
    console.log('  IPFS Hash:', result.ipfsHash);

    console.log('\n🎉 Done! Your campaign is now live on Sonic.');

  } catch (error) {
    console.error('\n❌ Error creating campaign:');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run the example
main();

