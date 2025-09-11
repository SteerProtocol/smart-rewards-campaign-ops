/**
 * Main Smart Rewards client that orchestrates the complete flow
 * Implements the end-to-end single campaign flow from the API specification
 */

import { ethers } from 'ethers';
import { GraphQLClient, defaultGraphQLClient } from '../clients/graphql-client';
import { SmartRewardsGraphQLClient } from '../clients/smart-rewards-client';
import { RewardCalculator } from './calculations';
import { OnChainClaimClient, ClaimOptions, ClaimTransactionResult } from '../blockchain/onchain-claim';
import { CampaignClient } from '../index';
import {
  SmartRewardsResult,
  SmartRewarderConfig,
  SmartRewardsError,
  ClaimProof,
  ClaimReward,
  Campaign,
  ClaimCalculations,
  FetchCampaignsResult
} from '../types';

export interface SmartRewardsClientConfig {
  graphqlClient?: GraphQLClient;
  provider?: ethers.JsonRpcProvider;
  signer?: ethers.Signer;
  smartRewarderConfig?: SmartRewarderConfig;
}

export interface ProcessCampaignOptions {
  executeClaimIfEligible?: boolean;
  claimOptions?: ClaimOptions;
  refreshAfterClaim?: boolean;
}

export class SmartRewardsClient {
  private graphqlClient: GraphQLClient;
  private smartRewardsClient: SmartRewardsGraphQLClient;
  private campaignClient: CampaignClient;
  private onChainClient?: OnChainClaimClient;

  constructor(config: SmartRewardsClientConfig = {}) {
    this.graphqlClient = config.graphqlClient || defaultGraphQLClient;
    this.smartRewardsClient = new SmartRewardsGraphQLClient(this.graphqlClient);
    this.campaignClient = new CampaignClient(this.graphqlClient);

    if (config.provider && config.signer && config.smartRewarderConfig) {
      this.onChainClient = new OnChainClaimClient(
        config.provider,
        config.signer,
        config.smartRewarderConfig
      );
    }
  }

  /**
   * Complete single campaign flow implementation
   * Fetches proofs, claims, calculates remaining, and optionally executes claim
   */
  async processCampaign(
    user: string,
    chainId: number,
    campaignId: number,
  ): Promise<SmartRewardsResult> {
      // Step 1: Find the campaign to get pool address and reward token info
      const campaign = await this.getCampaignById(chainId, campaignId);
      if (!campaign) {
        throw new SmartRewardsError(
          `Campaign ${campaignId} not found on chain ${chainId}`,
          user,
          campaignId,
          chainId
        );
      }

      // We dont' support this method now

      // const rewardTotal = await this.smartRewardsClient.fetchUserCampaignRewardTotalValidated(
      //   user,
      //   campaignId.toString(),
      //   chainId
      // );


      // Step 3: Fetch historical claims for (pool, chainId, user)
      console.log(`Fetching historical claims for pool ${campaign.liquidityPool}...`);
      const historicalClaims = await this.smartRewardsClient.fetchHistoricalClaimsValidated(
        campaign.liquidityPool.toLowerCase(),
        chainId,
        user,
        campaignId
      );


      const totalClaims = historicalClaims.reduce((acc, claim) => {
        return acc + parseFloat(claim.amount);
      }, 0);
 

      // Step 2: Fetch claim proofs for (user, chainId, campaignId)
      console.log(`Fetching claim proofs for user ${user}, campaign ${campaignId}...`);
      const proofs = await this.smartRewardsClient.fetchClaimProofsValidated(
        user,
        chainId,
        campaignId
      );


      const filteredClaimProofs = proofs.filter(
        edge => edge.campaignId === campaignId
      ) || [];

      const totalAmount = filteredClaimProofs.reduce(
        (sum, edge) => sum + BigInt(edge.amount.split('.')[0]),
        0n
      ) || 0n;

     
      return {
        user,
        chainId,
        campaign,
        proofs: filteredClaimProofs,
        historicalClaims,
        rewardsData: {
          totalAmount: totalAmount.toString(),
          campaignId: campaignId.toString(),
          chainId,
          count: filteredClaimProofs.length,
          rewardToken: campaign.rewardToken.symbol,
          user,
          totalClaimed: totalClaims.toString()
        }
      }
  }

  /**
   * Get campaign by ID from the campaigns API
   */
  private async getCampaignById(chainId: number, campaignId: number): Promise<Campaign | null> {
    try {
      // Fetch campaigns for the chain
      const result = await this.campaignClient.fetchCampaignsByChainId(chainId);
      
      // Find the specific campaign
      return result.campaigns.find(c => c.campaignId === campaignId) || null;
    } catch (error) {
      throw new SmartRewardsError(
        `Failed to fetch campaign ${campaignId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        campaignId,
        chainId
      );
    }
  }

  /**
   * Get claim proofs for a user and campaign
   */
  async getClaimProofs(
    user: string,
    chainId: number,
    campaignId: number
  ): Promise<ClaimProof[]> {
    return this.smartRewardsClient.fetchClaimProofsValidated(user, chainId, campaignId);
  }

  /**
   * Get historical claims for a user in a specific pool/campaign
   */
  async getHistoricalClaims(
    pool: string,
    chainId: number,
    user: string,
    campaignId?: number
  ): Promise<ClaimReward[]> {
    return this.smartRewardsClient.fetchHistoricalClaimsValidated(pool, chainId, user, campaignId);
  }

  /**
   * Calculate rewards for a user and campaign
   */
  async calculateRewards(
    user: string,
    chainId: number,
    campaignId: number
  ): Promise<{
    proofs: ClaimProof[];
    claims: ClaimReward[];
    calculations: ClaimCalculations;
    rewardTokenDecimals: number;
  }> {
    const campaign = await this.getCampaignById(chainId, campaignId);
    if (!campaign) {
      throw new SmartRewardsError(`Campaign ${campaignId} not found`, user, campaignId, chainId);
    }

    const proofs = await this.getClaimProofs(user, chainId, campaignId);
    const claims = await this.getHistoricalClaims(campaign.liquidityPool, chainId, user, campaignId);
    
    const calculations = RewardCalculator.performCalculations(
      proofs,
      claims,
      campaignId,
      campaign.rewardToken.decimals
    );

    return {
      proofs,
      claims,
      calculations,
      rewardTokenDecimals: campaign.rewardToken.decimals
    };
  }

  /**
   * Execute claim transaction
   */
  async executeClaim(
    chainId: number,
    proofs: ClaimProof[],
    decimals: number,
    options: ClaimOptions = {}
  ): Promise<ClaimTransactionResult> {
    if (!this.onChainClient) {
      throw new SmartRewardsError('On-chain client not configured. Provide provider, signer, and SmartRewarder config.');
    }

    if (proofs.length === 0) {
      throw new SmartRewardsError('No proofs available for claiming');
    }

    if (proofs.length === 1) {
      return this.onChainClient.claimSingle(chainId, proofs[0], decimals, options);
    } else {
      return this.onChainClient.claimBatch(chainId, proofs, decimals, options);
    }
  }

  /**
   * Check if user can claim rewards for a campaign
   */
  async canUserClaim(user: string, chainId: number, campaignId: number): Promise<{
    canClaim: boolean;
    remaining: string; // in human-readable format
    totalEligible: string;
    totalClaimed: string;
    rewardTokenSymbol: string;
  }> {
    const { calculations, rewardTokenDecimals } = await this.calculateRewards(
      user, 
      chainId, 
      campaignId
    );

    const campaign = await this.getCampaignById(chainId, campaignId);
    const rewardTokenSymbol = campaign?.rewardToken.symbol || 'Unknown';

    const formatted = RewardCalculator.formatCalculations(calculations, rewardTokenDecimals);

    return {
      canClaim: calculations.canClaim,
      remaining: formatted.remaining,
      totalEligible: formatted.totalEligible,
      totalClaimed: formatted.totalClaimed,
      rewardTokenSymbol
    };
  }


  async getCampaignsByChainId(chainId: number): Promise<FetchCampaignsResult> {
    return this.campaignClient.fetchCampaignsByChainId(chainId);
  }

  /**
   * Get user's claimable campaigns on a chain
   */
  async getUserClaimableCampaigns(
    user: string,
    chainId: number,
    campaigns: Campaign[],
    limit?: number
  ): Promise<Array<{
    campaign: Campaign;
    canClaim: boolean;
    remaining: string;
    calculations: ClaimCalculations;
  }>> {
    try {
      // Get all campaigns on the chain
    //   const campaignsResult = await this.campaignClient.fetchCampaignsByChainId(chainId);
    //   const campaigns = limit ? campaignsResult.campaigns.slice(0, limit) : campaignsResult.campaigns;

      const results = [];

      for (const campaign of campaigns) {
        try {
          const { calculations } = await this.calculateRewards(user, chainId, campaign.campaignId);
          const formatted = RewardCalculator.formatCalculations(calculations, campaign.rewardToken.decimals);

          results.push({
            campaign,
            canClaim: calculations.canClaim,
            remaining: formatted.remaining,
            calculations
          });
        } catch (error) {
          // Skip campaigns where we can't calculate rewards (e.g., no proofs)
          console.warn(`Skipping campaign ${campaign.campaignId}:`, error instanceof Error ? error.message : error);
        }
      }

      return results.sort((a, b) => {
        // Sort by claimable first, then by remaining amount
        if (a.canClaim !== b.canClaim) {
          return a.canClaim ? -1 : 1;
        }
        return parseFloat(b.remaining) - parseFloat(a.remaining);
      });

    } catch (error) {
      throw new SmartRewardsError(
        `Failed to get claimable campaigns: ${error instanceof Error ? error.message : 'Unknown error'}`,
        user,
        undefined,
        chainId
      );
    }
  }

  /**
   * Estimate gas for claiming specific proofs
   */
  async estimateClaimGas(
    chainId: number,
    proofs: ClaimProof[],
    decimals: number
  ): Promise<string> {
    if (!this.onChainClient) {
      throw new SmartRewardsError('On-chain client not configured');
    }

    const claimArgs = this.onChainClient.prepareClaimArgs(proofs);
    return this.onChainClient.estimateClaimGas(chainId, claimArgs);
  }

  /**
   * Set up on-chain functionality
   */
  setupOnChain(
    provider: ethers.JsonRpcProvider,
    signer: ethers.Signer,
    smartRewarderConfig: SmartRewarderConfig
  ): void {
    this.onChainClient = new OnChainClaimClient(provider, signer, smartRewarderConfig);
  }

  /**
   * Check if on-chain functionality is available
   */
  hasOnChainCapability(): boolean {
    return this.onChainClient !== undefined;
  }

}
