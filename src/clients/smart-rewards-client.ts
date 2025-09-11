/**
 * Smart Rewards GraphQL client for claim proofs and historical claims
 * Implements the Smart Rewards API specification
 */

import { GraphQLClient } from './graphql-client';
import {
  ClaimProofsResponse,
  ClaimRewardsResponse,
  ClaimProofQueryVariables,
  ClaimRewardQueryVariables,
  ClaimProof,
  ClaimReward,
  SmartRewardsError,
  GraphQLResponse,
  UserCampaignRewardTotalResponse,
  UserCampaignRewardTotalQueryVariables,
  UserCampaignRewardTotal
} from '../types';

const CLAIM_PROOF_QUERY = `
query ClaimProofEdges($user: String!, $filter: ClaimProofFilter, $after: String) {
  claimProofs(user: $user, filter: $filter, after: $after) {
    totalCount
    edges {
      node {
        chainId
        lastBlockUpdatedTo
        user
        campaignId
        amount
        proof
      }
      cursor
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}`;

const CLAIM_REWARDS_QUERY = `
query ClaimRewards($pool: String!, $chainId: Int!, $filter: ClaimRewardFilter, $after: String) {
  claimRewards(poolId: $pool, chainId: $chainId, filter: $filter, after: $after) {
    edges {
      cursor
      node {
        id
        user
        amount
        campaign
        chainId
        timestamp
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}`;

const USER_CAMPAIGN_REWARD_TOTAL_QUERY = `
query UserCampaignRewardTotal($user: String!, $campaignId: String!, $chainId: Int!) {
  userCampaignRewardTotal(user: $user, campaignId: $campaignId, chainId: $chainId) {
    campaignId
    chainId
    count
    rewardToken
    totalAmount
    user
  }
}`;

export class SmartRewardsGraphQLClient {
  private client: GraphQLClient;

  constructor(client: GraphQLClient) {
    this.client = client;
  }

  /**
   * Fetch claim proofs for a specific user and campaign
   */
  async fetchClaimProofs(
    user: string,
    chainId: number,
    campaignId: number,
    cursor?: string | null
  ): Promise<ClaimProofsResponse> {
    const variables: ClaimProofQueryVariables = {
      user,
      filter: { chainId, campaignId },
      after: cursor
    };

    try {
      const response = await this.client.request<ClaimProofsResponse>(
        CLAIM_PROOF_QUERY,
        variables,
        'ClaimProofEdges'
      );

      if (!response.data) {
        throw new SmartRewardsError('No data received from claim proofs query', user, campaignId, chainId);
      }

      return response.data;
    } catch (error) {
      throw new SmartRewardsError(
        `Failed to fetch claim proofs: ${error instanceof Error ? error.message : 'Unknown error'}`,
        user,
        campaignId,
        chainId
      );
    }
  }

  /**
   * Fetch all claim proofs for a user and campaign with pagination
   */
  async fetchAllClaimProofs(
    user: string,
    chainId: number,
    campaignId: number
  ): Promise<ClaimProof[]> {
    const allProofs: ClaimProof[] = [];
    let cursor: string | null = null;
    let hasNextPage = true;

    try {
      while (hasNextPage) {
        const response = await this.fetchClaimProofs(user, chainId, campaignId, cursor);
        
        const proofs = response.claimProofs.edges.map(edge => edge.node);
        allProofs.push(...proofs);

        hasNextPage = response.claimProofs.pageInfo.hasNextPage;
        cursor = response.claimProofs.pageInfo.endCursor;

        // Safety check to prevent infinite loops
        if (!cursor && hasNextPage) {
          console.warn('hasNextPage is true but no cursor provided, stopping pagination');
          break;
        }
      }

      return allProofs;
    } catch (error) {
      throw new SmartRewardsError(
        `Failed to fetch all claim proofs: ${error instanceof Error ? error.message : 'Unknown error'}`,
        user,
        campaignId,
        chainId
      );
    }
  }

  /**
   * Fetch historical claims for a user in a specific pool
   */
  async fetchHistoricalClaims(
    pool: string,
    chainId: number,
    user: string,
    cursor?: string | null
  ): Promise<ClaimRewardsResponse> {
    const variables: ClaimRewardQueryVariables = {
      pool: pool.toLowerCase(),
      chainId,
      filter: { user },
      after: cursor
    };

    try {
      const response = await this.client.request<ClaimRewardsResponse>(
        CLAIM_REWARDS_QUERY,
        variables,
        'ClaimRewards'
      );

      if (!response.data) {
        throw new SmartRewardsError('No data received from historical claims query', user, undefined, chainId);
      }

      return response.data;
    } catch (error) {
      throw new SmartRewardsError(
        `Failed to fetch historical claims: ${error instanceof Error ? error.message : 'Unknown error'}`,
        user,
        undefined,
        chainId
      );
    }
  }

  /**
   * Fetch all historical claims for a user in a specific pool with pagination
   */
  async fetchAllHistoricalClaims(
    pool: string,
    chainId: number,
    user: string
  ): Promise<ClaimReward[]> {
    const allClaims: ClaimReward[] = [];
    let cursor: string | null = null;
    let hasNextPage = true;

    try {
      while (hasNextPage) {
        const response = await this.fetchHistoricalClaims(pool, chainId, user, cursor);
        
        const claims = response.claimRewards.edges.map(edge => edge.node);
        allClaims.push(...claims);

        hasNextPage = response.claimRewards.pageInfo.hasNextPage;
        cursor = response.claimRewards.pageInfo.endCursor;

        // Safety check to prevent infinite loops
        if (!cursor && hasNextPage) {
          console.warn('hasNextPage is true but no cursor provided, stopping pagination');
          break;
        }
      }

      return allClaims;
    } catch (error) {
      throw new SmartRewardsError(
        `Failed to fetch all historical claims: ${error instanceof Error ? error.message : 'Unknown error'}`,
        user,
        undefined,
        chainId
      );
    }
  }

  /**
   * Fetch historical claims filtered by campaign
   */
  async fetchHistoricalClaimsForCampaign(
    pool: string,
    chainId: number,
    user: string,
    campaignId: number
  ): Promise<ClaimReward[]> {
    try {
      const allClaims = await this.fetchAllHistoricalClaims(pool, chainId, user);
      
      // Filter by campaign (campaign field is a string representation of campaignId)
      return allClaims.filter(claim => Number(claim.campaign) === campaignId);
    } catch (error) {
      throw new SmartRewardsError(
        `Failed to fetch historical claims for campaign: ${error instanceof Error ? error.message : 'Unknown error'}`,
        user,
        campaignId,
        chainId
      );
    }
  }

  /**
   * Fetch user campaign reward total for a specific user, campaign, and chain
   */
  async fetchUserCampaignRewardTotal(
    user: string,
    campaignId: string,
    chainId: number
  ): Promise<UserCampaignRewardTotal> {
    const variables: UserCampaignRewardTotalQueryVariables = {
      user,
      campaignId,
      chainId
    };

    try {
      const response = await this.client.request<UserCampaignRewardTotalResponse>(
        USER_CAMPAIGN_REWARD_TOTAL_QUERY,
        variables,
        'UserCampaignRewardTotal'
      );

      if (!response.data) {
        throw new SmartRewardsError('No data received from user campaign reward total query', user, Number(campaignId), chainId);
      }

      return response.data.userCampaignRewardTotal;
    } catch (error) {
      throw new SmartRewardsError(
        `Failed to fetch user campaign reward total: ${error instanceof Error ? error.message : 'Unknown error'}`,
        user,
        Number(campaignId),
        chainId
      );
    }
  }

  /**
   * Fetch user campaign reward total with validation
   */
  async fetchUserCampaignRewardTotalValidated(
    user: string,
    campaignId: string,
    chainId: number
  ): Promise<UserCampaignRewardTotal> {
    this.validateUserAddress(user);
    this.validateChainId(chainId);
    this.validateCampaignIdString(campaignId);

    return this.fetchUserCampaignRewardTotal(user, campaignId, chainId);
  }

  /**
   * Validate user address format
   */
  private validateUserAddress(user: string): void {
    if (!user || !/^0x[a-fA-F0-9]{40}$/.test(user)) {
      throw new SmartRewardsError(`Invalid user address format: ${user}`);
    }
  }

  /**
   * Validate pool address format
   */
  private validatePoolAddress(pool: string): void {
    if (!pool || !/^0x[a-fA-F0-9]{40}$/.test(pool)) {
      throw new SmartRewardsError(`Invalid pool address format: ${pool}`);
    }
  }

  /**
   * Validate chain ID
   */
  private validateChainId(chainId: number): void {
    if (!chainId || chainId <= 0) {
      throw new SmartRewardsError(`Invalid chain ID: ${chainId}`);
    }
  }

  /**
   * Validate campaign ID
   */
  private validateCampaignId(campaignId: number): void {
    if (!campaignId || campaignId <= 0) {
      throw new SmartRewardsError(`Invalid campaign ID: ${campaignId}`);
    }
  }

  /**
   * Validate campaign ID string
   */
  private validateCampaignIdString(campaignId: string): void {
    if (!campaignId || !/^\d+$/.test(campaignId) || Number(campaignId) <= 0) {
      throw new SmartRewardsError(`Invalid campaign ID string: ${campaignId}`);
    }
  }

  /**
   * Fetch claim proofs with validation
   */
  async fetchClaimProofsValidated(
    user: string,
    chainId: number,
    campaignId: number
  ): Promise<ClaimProof[]> {
    this.validateUserAddress(user);
    this.validateChainId(chainId);
    this.validateCampaignId(campaignId);

    return this.fetchAllClaimProofs(user, chainId, campaignId);
  }

  /**
   * Fetch historical claims with validation
   */
  async fetchHistoricalClaimsValidated(
    pool: string,
    chainId: number,
    user: string,
    campaignId?: number
  ): Promise<ClaimReward[]> {
    this.validatePoolAddress(pool);
    this.validateChainId(chainId);
    this.validateUserAddress(user);

    if (campaignId !== undefined) {
      this.validateCampaignId(campaignId);
      return this.fetchHistoricalClaimsForCampaign(pool, chainId, user, campaignId);
    }

    return this.fetchAllHistoricalClaims(pool, chainId, user);
  }

  /**
   * Get statistics for claim proofs
   */
  getClaimProofStats(proofs: ClaimProof[]): {
    totalProofs: number;
    totalAmount: string; // sum of decimal amounts
    latestBlock: number;
    campaigns: number[];
  } {
    if (proofs.length === 0) {
      return {
        totalProofs: 0,
        totalAmount: '0',
        latestBlock: 0,
        campaigns: []
      };
    }

    const totalAmount = proofs.reduce((sum, proof) => {
      return (parseFloat(sum) + parseFloat(proof.amount)).toString();
    }, '0');

    const latestBlock = Math.max(...proofs.map(p => p.lastBlockUpdatedTo));
    const campaigns = [...new Set(proofs.map(p => p.campaignId))];

    return {
      totalProofs: proofs.length,
      totalAmount,
      latestBlock,
      campaigns
    };
  }

  /**
   * Get statistics for historical claims
   */
  getHistoricalClaimStats(claims: ClaimReward[]): {
    totalClaims: number;
    totalAmount: string; // sum of decimal amounts
    latestTimestamp: number;
    campaigns: string[];
    claimIds: string[];
  } {
    if (claims.length === 0) {
      return {
        totalClaims: 0,
        totalAmount: '0',
        latestTimestamp: 0,
        campaigns: [],
        claimIds: []
      };
    }

    const totalAmount = claims.reduce((sum, claim) => {
      return (parseFloat(sum) + parseFloat(claim.amount)).toString();
    }, '0');

    const latestTimestamp = Math.max(...claims.map(c => c.timestamp));
    const campaigns = [...new Set(claims.map(c => c.campaign))];
    const claimIds = claims.map(c => c.id);

    return {
      totalClaims: claims.length,
      totalAmount,
      latestTimestamp,
      campaigns,
      claimIds
    };
  }

  /**
   * Get formatted user campaign reward total statistics
   */
  getUserCampaignRewardTotalStats(rewardTotal: UserCampaignRewardTotal): {
    campaignId: string;
    chainId: number;
    user: string;
    rewardToken: string;
    totalAmount: string;
    totalAmountFormatted: string; // with decimals consideration
    count: number;
    hasRewards: boolean;
  } {
    const hasRewards = parseFloat(rewardTotal.totalAmount) > 0;
    
    return {
      campaignId: rewardTotal.campaignId,
      chainId: rewardTotal.chainId,
      user: rewardTotal.user,
      rewardToken: rewardTotal.rewardToken,
      totalAmount: rewardTotal.totalAmount,
      totalAmountFormatted: rewardTotal.totalAmount, // Could be enhanced with decimal formatting
      count: rewardTotal.count,
      hasRewards
    };
  }
}

