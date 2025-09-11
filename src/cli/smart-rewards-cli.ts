#!/usr/bin/env ts-node

/**
 * CLI script for Smart Rewards operations
 * Usage: ts-node src/campaign/smart-rewards-cli.ts <command> [options]
 */

import { ethers } from "ethers";
import { SmartRewardsClient } from "../core/smart-rewards";
import { SmartRewarderConfig, SmartRewardsResult } from "../types";
import { RewardCalculator } from "../core/calculations";

// ANSI color codes for better terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m'
};

// Helper functions for formatting
function formatHeader(text: string): string {
  return `${colors.bright}${colors.cyan}${'═'.repeat(80)}${colors.reset}\n${colors.bright}${colors.cyan}${text}${colors.reset}\n${colors.bright}${colors.cyan}${'═'.repeat(80)}${colors.reset}`;
}

function formatSubHeader(text: string): string {
  return `${colors.bright}${colors.yellow}${text}${colors.reset}`;
}

function formatSuccess(text: string): string {
  return `${colors.green}✅ ${text}${colors.reset}`;
}

function formatWarning(text: string): string {
  return `${colors.yellow}⚠️  ${text}${colors.reset}`;
}

function formatError(text: string): string {
  return `${colors.red}❌ ${text}${colors.reset}`;
}

function formatAmount(amount: string, decimals: number, symbol: string): string {
  try {
    const formatted = RewardCalculator.fromBaseUnits(amount, decimals);
    return `${colors.bright}${colors.green}${formatted} ${symbol}${colors.reset}`;
  } catch {
    return `${colors.bright}${colors.green}${amount} ${symbol} (raw)${colors.reset}`;
  }
}

function formatAddress(address: string): string {
  return `${colors.gray}${address.slice(0, 6)}...${address.slice(-4)}${colors.reset}`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

function createTable(headers: string[], rows: string[][]): string {
  const columnWidths = headers.map((header, index) => 
    Math.max(header.length, ...rows.map(row => row[index]?.length || 0))
  );
  
  const separator = '├' + columnWidths.map(width => '─'.repeat(width + 2)).join('┼') + '┤';
  const topBorder = '┌' + columnWidths.map(width => '─'.repeat(width + 2)).join('┬') + '┐';
  const bottomBorder = '└' + columnWidths.map(width => '─'.repeat(width + 2)).join('┴') + '┘';
  
  let table = topBorder + '\n';
  
  // Headers
  table += '│ ' + headers.map((header, index) => 
    header.padEnd(columnWidths[index])
  ).join(' │ ') + ' │\n';
  
  table += separator + '\n';
  
  // Rows
  rows.forEach(row => {
    table += '│ ' + row.map((cell, index) => 
      cell.padEnd(columnWidths[index])
    ).join(' │ ') + ' │\n';
  });
  
  table += bottomBorder;
  
  return table;
}




async function campaignDetails({
  chainId,
  campaignId,
  user,
}: {
  chainId: number;
  campaignId: number;
  user: string;
}): Promise<SmartRewardsResult> {
  const client = new SmartRewardsClient();

  try {
    const result = await client.processCampaign(user, chainId, campaignId);
    return result;
  } catch (error) {
    console.error(
      formatError(`Error getting campaign details: ${error instanceof Error ? error.message : error}`)
    );
    throw error;
  }
}

function displayCampaignSummary(result: SmartRewardsResult): void {
  const { campaign, proofs, historicalClaims, rewardsData } = result;
  
  console.log(formatSubHeader(`\n📊 Campaign ${campaign.campaignId}: ${campaign.name}`));
  console.log(`${colors.gray}Protocol:${colors.reset} ${campaign.protocol}`);
  console.log(`${colors.gray}Type:${colors.reset} ${campaign.campaignType}`);
  console.log(`${colors.gray}Status:${colors.reset} ${campaign.closed ? '🔒 Closed' : campaign.paused ? '⏸️  Paused' : '🟢 Active'}`);
  console.log(`${colors.gray}Pool:${colors.reset} ${formatAddress(campaign.liquidityPool)}`);
  console.log(`${colors.gray}Reward Token:${colors.reset} ${campaign.rewardToken.symbol} (${campaign.rewardToken.name})`);
  console.log(`${colors.gray}Total Rewards Claimed:${colors.reset} ${rewardsData.totalClaimed}`);
  

  // Campaign timeline
  const startDate = new Date(campaign.campaignStartTimestamp).toLocaleDateString();
  const endDate = new Date(campaign.campaignEndTimestamp).toLocaleDateString();
  console.log(`${colors.gray}Duration:${colors.reset} ${startDate} → ${endDate}`);
  
  // Distribution info
  const totalDistribution = formatAmount(
    RewardCalculator.toBaseUnits(campaign.distributionAmount, campaign.rewardToken.decimals),
    campaign.rewardToken.decimals,
    campaign.rewardToken.symbol
  );
  console.log(`${colors.gray}Total Distribution:${colors.reset} ${totalDistribution}`);
  
  // User rewards summary
  console.log(`\n${formatSubHeader('🎯 Your Rewards Summary')}`);
  
  if (BigInt(rewardsData.totalAmount) > 0) {
    const totalRewards = formatAmount(
      RewardCalculator.toBaseUnits(rewardsData.totalAmount, campaign.rewardToken.decimals),
      campaign.rewardToken.decimals,
      campaign.rewardToken.symbol
    );
    console.log(`${colors.gray}Total Eligible:${colors.reset} ${totalRewards}`);
    console.log(`${colors.gray}Reward Count:${colors.reset} ${rewardsData.count}`);
  } else {
    console.log(formatWarning('No rewards found for this campaign'));
  }
  
  // Claim proofs
  if (proofs.length > 0) {
    console.log(`\n${formatSubHeader('📝 Claim Proofs Available')}`);
    proofs.forEach((proof, index) => {
      const amount = formatAmount(proof.amount, campaign.rewardToken.decimals, campaign.rewardToken.symbol);
      console.log(`  ${index + 1}. ${amount} (Block: ${proof.lastBlockUpdatedTo})`);
      console.log(`     ${colors.gray}Proof Elements:${colors.reset} ${proof.proof.length}`);
    });
  } else {
    console.log(`\n${formatWarning('No claim proofs available')}`);
  }
  
  // Historical claims
  if (historicalClaims.length > 0) {
    console.log(`\n${formatSubHeader('📜 Historical Claims')}`);
    historicalClaims.forEach((claim, index) => {
      const amount = formatAmount(claim.amount, campaign.rewardToken.decimals, campaign.rewardToken.symbol);
      const date = formatDate(claim.timestamp);
      console.log(`  ${index + 1}. ${amount} (${date})`);
      console.log(`     ${colors.gray}Transaction ID:${colors.reset} ${claim.id}`);
    });
  }
}



export async function processCampaignAndClaims(): Promise<void> {
  console.log(formatHeader('🚀 SMART REWARDS CAMPAIGN PROCESSOR'));
  
  try {
    // Configuration
    const rpcUrl = "https://rpc.soniclabs.com";
    const chainId = 146;
    const smartRewarderAddresses = "0x00f5D63E1b0b68303B03f17E3AA77f5c062d9dDC";
    const user = "0x137fdfaf6cc1cb86c5f9648c8fbabc88407b182a";

    console.log(formatSubHeader('\n🔧 Configuration'));
    console.log(`${colors.gray}Chain ID:${colors.reset} ${chainId} (Sonic Network)`);
    console.log(`${colors.gray}RPC URL:${colors.reset} ${rpcUrl}`);
    console.log(`${colors.gray}User Address:${colors.reset} ${formatAddress(user)}`);
    console.log(`${colors.gray}Smart Rewarder:${colors.reset} ${formatAddress(smartRewarderAddresses)}`);

    // Initialize clients
    console.log(formatSubHeader('\n⚙️  Initializing Clients'));
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = ethers.Wallet.createRandom();
    const signer = wallet.connect(provider);

    const config: SmartRewarderConfig = {
      [chainId]: smartRewarderAddresses,
    };

    const client = new SmartRewardsClient({
      provider,
      signer,
      smartRewarderConfig: config,
    });

    console.log(formatSuccess('Smart Rewards Client initialized'));

    // Fetch campaigns
    console.log(formatSubHeader('\n📋 Fetching Campaigns'));
    const { campaigns, totalCount } = await client.getCampaignsByChainId(chainId);
    console.log(formatSuccess(`Found ${totalCount} campaigns on chain ${chainId}`));

    // Process each campaign
    console.log(formatSubHeader('\n🔍 Processing Campaigns'));
    const campaignResults: SmartRewardsResult[] = [];
    let processedCount = 0;

    for (const campaign of campaigns) {
      processedCount++;
      console.log(`\n${colors.bright}${colors.blue}[${processedCount}/${campaigns.length}]${colors.reset} Processing Campaign ${campaign.campaignId}...`);
      
      try {
        const campaignResult = await campaignDetails({
          user,
          chainId,
          campaignId: campaign.campaignId,
        });

        campaignResults.push(campaignResult);
        displayCampaignSummary(campaignResult);
        
      } catch (error) {
        console.error(formatError(`Failed to process campaign ${campaign.campaignId}: ${error instanceof Error ? error.message : error}`));
        continue;
      }
    }

    // Summary analysis
    console.log(formatHeader('\n📊 CAMPAIGN ANALYSIS SUMMARY'));
    
    const campaignsWithRewards = campaignResults.filter(
      (result) => BigInt(result.rewardsData.totalAmount) > BigInt(0)
    );

    const campaignsWithProofs = campaignResults.filter(
      (result) => result.proofs.length > 0
    );

    const campaignsWithClaims = campaignResults.filter(
      (result) => result.historicalClaims.length > 0
    );

    // Summary statistics
    console.log(formatSubHeader('\n📈 Statistics'));
    console.log(`${colors.gray}Total Campaigns:${colors.reset} ${campaignResults.length}`);
    console.log(`${colors.gray}Campaigns with Rewards:${colors.reset} ${campaignsWithRewards.length}`);
    console.log(`${colors.gray}Campaigns with Proofs:${colors.reset} ${campaignsWithProofs.length}`);
    console.log(`${colors.gray}Campaigns with Claims:${colors.reset} ${campaignsWithClaims.length}`);

    // Claimable campaigns table
    if (campaignsWithProofs.length > 0) {
      console.log(formatSubHeader('\n💰 Claimable Campaigns'));
      
      const tableHeaders = ['Campaign', 'Name', 'Token', 'Claimable Amount', 'Proofs', 'Status'];
      const tableRows = campaignsWithProofs.map(result => {
        const totalClaimable = result.proofs.reduce((sum, proof) => {
          try {
            const amount = RewardCalculator.fromBaseUnits(proof.amount, result.campaign.rewardToken.decimals);
            return (parseFloat(sum) + parseFloat(amount)).toString();
          } catch {
            return sum;
          }
        }, '0');
        
        return [
          result.campaign.campaignId.toString(),
          result.campaign.name.substring(0, 20) + (result.campaign.name.length > 20 ? '...' : ''),
          result.campaign.rewardToken.symbol,
          `${totalClaimable} ${result.campaign.rewardToken.symbol}`,
          result.proofs.length.toString(),
          result.campaign.closed ? 'Closed' : result.campaign.paused ? 'Paused' : 'Active'
        ];
      });

      console.log(createTable(tableHeaders, tableRows));
    }

    // Total claimable value summary
    if (campaignsWithProofs.length > 0) {
      console.log(formatSubHeader('\n💎 Total Claimable Summary'));
      const tokenSummary = new Map<string, { amount: number; symbol: string; decimals: number }>();
      
      campaignsWithProofs.forEach(result => {
        const symbol = result.campaign.rewardToken.symbol;
        const decimals = result.campaign.rewardToken.decimals;
        
        result.proofs.forEach(proof => {
          try {
            const amount = parseFloat(RewardCalculator.fromBaseUnits(proof.amount, decimals));
            const current = tokenSummary.get(symbol) || { amount: 0, symbol, decimals };
            tokenSummary.set(symbol, { 
              amount: current.amount + amount, 
              symbol, 
              decimals 
            });
          } catch {
            // Skip invalid amounts
          }
        });
      });

      tokenSummary.forEach(({ amount, symbol }) => {
        console.log(`  ${formatAmount(amount.toString(), 18, symbol)}`);
      });
    }

    // Final recommendations
    console.log(formatSubHeader('\n🎯 Recommendations'));
    
    if (campaignsWithProofs.length > 0) {
      console.log(formatSuccess(`You have claimable rewards in ${campaignsWithProofs.length} campaign(s)!`));
      console.log(`${colors.cyan}💡 Next steps:${colors.reset}`);
      console.log(`   1. Review the claimable campaigns above`);
      console.log(`   2. Execute claims for campaigns with available proofs`);
      console.log(`   3. Monitor for new campaigns and rewards`);
    } else {
      console.log(formatWarning('No claimable rewards found at this time'));
      console.log(`${colors.cyan}💡 Suggestions:${colors.reset}`);
      console.log(`   1. Check back later for new campaigns`);
      console.log(`   2. Participate in active liquidity programs`);
      console.log(`   3. Monitor your positions for reward eligibility`);
    }

    console.log(formatHeader('\n✨ PROCESSING COMPLETE'));
    
  } catch (error) {
    console.error(formatError(`Fatal error: ${error instanceof Error ? error.message : error}`));
    process.exit(1);
  }
}

