/**
 * Smart Rewards Campaign Operations - Main Entry Point
 * 
 * This is the main entry point for the Smart Rewards Campaign Operations library.
 * It provides a comprehensive TypeScript client for managing campaign operations,
 * rewards calculation, and on-chain claims.
 * 
 * Features:
 * - Campaign data fetching with pagination
 * - Token metadata enrichment
 * - Smart rewards calculations
 * - On-chain claim execution
 * - Error handling and validation
 * 
 * Usage:
 * ```typescript
 * import { SmartRewardsClient, fetchCampaignsByChainId } from 'smart-rewards-campaign-ops';
 * 
 * // Simple usage
 * const campaigns = await fetchCampaignsByChainId(1); // Ethereum mainnet
 * 
 * // Advanced usage with client
 * const client = new SmartRewardsClient();
 * const result = await client.processCampaign(userAddress, chainId, campaignId);
 * ```
 */

import { GraphQLClient, defaultGraphQLClient } from './clients/graphql-client';
import { TokenEnrichmentClient } from './clients/token-enrichment';
import { PaginationManager, PaginationOptions } from './core/pagination';
import {
  FetchCampaignsResult,
  CampaignFetchOptions,
  Campaign,
  CampaignAPIError,
  EnrichmentOptions
} from './types';
import { processCampaignAndClaims } from './cli/smart-rewards-cli';

// Main application class and entry point
export class SmartRewardsCampaignOps {
  private static instance: SmartRewardsCampaignOps;
  
  private constructor() {
    console.log('🚀 Smart Rewards Campaign Operations initialized');
  }
  
  static getInstance(): SmartRewardsCampaignOps {
    if (!SmartRewardsCampaignOps.instance) {
      SmartRewardsCampaignOps.instance = new SmartRewardsCampaignOps();
    }
    return SmartRewardsCampaignOps.instance;
  }
  
  /**
   * Start the application
   */
  async start(): Promise<void> {
    await processCampaignAndClaims();
  }
}

export class CampaignClient {
  private graphqlClient: GraphQLClient;
  private paginationManager: PaginationManager;
  private tokenEnrichmentClient?: TokenEnrichmentClient;

  constructor(
    graphqlClient: GraphQLClient = defaultGraphQLClient,
    rpcUrl?: string,
    enableCache: boolean = true
  ) {
    this.graphqlClient = graphqlClient;
    this.paginationManager = new PaginationManager(graphqlClient);
    
    if (rpcUrl) {
      this.tokenEnrichmentClient = new TokenEnrichmentClient(rpcUrl, enableCache);
    }
  }

  /**
   * Main function to fetch all campaigns by chainId
   * Implements the complete API specification including pagination and optional enrichment
   */
  async fetchCampaignsByChainId(
    chainId: number,
    options: CampaignFetchOptions = {}
  ): Promise<FetchCampaignsResult> {
    const {
      pageSize = 50,
      enrichment = {}
    } = options;

    const {
      enableTokenEnrichment = false,
      rpcUrl,
      cacheTokenMetadata = true
    } = enrichment;

    try {
      // Validate chainId
      if (!chainId || chainId <= 0) {
        throw new CampaignAPIError('Invalid chainId provided');
      }

      // Validate page size
      if (pageSize <= 0 || pageSize > 1000) {
        throw new CampaignAPIError('Page size must be between 1 and 1000');
      }

      // Set up token enrichment if requested
      let enrichmentClient: TokenEnrichmentClient | undefined;
      if (enableTokenEnrichment) {
        if (!rpcUrl && !this.tokenEnrichmentClient) {
          throw new CampaignAPIError('RPC URL required for token enrichment');
        }
        enrichmentClient = rpcUrl 
          ? new TokenEnrichmentClient(rpcUrl, cacheTokenMetadata)
          : this.tokenEnrichmentClient;
      }

      // Fetch all campaigns using pagination
      const paginationResult = await this.paginationManager.fetchAllCampaigns(
        chainId,
        {
          pageSize,
          onPageFetched: (page, campaigns, hasMore) => {
            console.log(`Fetched page ${page}: ${campaigns.length} campaigns (more: ${hasMore})`);
          }
        }
      );

      let { campaigns } = paginationResult;
      const { pageInfo, totalCount } = paginationResult;

      // Enrich campaigns with token metadata if requested
      if (enableTokenEnrichment && enrichmentClient) {
        console.log('Enriching campaigns with token metadata...');
        campaigns = await enrichmentClient.enrichCampaigns(campaigns);
      }

      return {
        chainId,
        totalCount,
        pageInfo,
        campaigns
      };

    } catch (error) {
      if (error instanceof CampaignAPIError) {
        throw error;
      }
      
      throw new CampaignAPIError(
        `Failed to fetch campaigns for chainId ${chainId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        error
      );
    }
  }

  /**
   * Fetch a single page of campaigns
   */
  async fetchCampaignsPage(
    chainId: number,
    cursor?: string | null,
    pageSize: number = 50
  ): Promise<{
    campaigns: Campaign[];
    pageInfo: { endCursor: string; hasNextPage: boolean };
    totalCount: number;
  }> {
    try {
      const result = await this.paginationManager.fetchCampaignsPage(
        chainId,
        cursor,
        pageSize
      );

      return {
        campaigns: result.campaigns,
        pageInfo: result.pageInfo,
        totalCount: result.totalCount
      };
    } catch (error) {
      throw new CampaignAPIError(
        `Failed to fetch campaigns page for chainId ${chainId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        error
      );
    }
  }

  /**
   * Process campaigns in chunks with a callback
   */
  async processCampaignsInChunks(
    chainId: number,
    processor: (campaigns: Campaign[], pageInfo: { page: number; total: number; hasMore: boolean }) => Promise<void> | void,
    options: PaginationOptions = {}
  ): Promise<void> {
    try {
      await this.paginationManager.processInChunks(chainId, processor, options);
    } catch (error) {
      throw new CampaignAPIError(
        `Failed to process campaigns in chunks for chainId ${chainId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        error
      );
    }
  }

  /**
   * Get an async iterator for paginated results
   */
  iterateCampaigns(
    chainId: number,
    pageSize: number = 50
  ): AsyncIterableIterator<{
    campaigns: Campaign[];
    pageInfo: { endCursor: string; hasNextPage: boolean };
    totalCount: number;
    pageNumber: number;
  }> {
    return this.paginationManager.iteratePages(chainId, pageSize);
  }

  /**
   * Set custom GraphQL headers
   */
  setGraphQLHeaders(headers: Record<string, string>): void {
    this.graphqlClient.setHeaders(headers);
  }

  /**
   * Get the current GraphQL endpoint
   */
  getGraphQLEndpoint(): string {
    return this.graphqlClient.getEndpoint();
  }

  /**
   * Clear token enrichment cache
   */
  clearTokenCache(): void {
    if (this.tokenEnrichmentClient) {
      this.tokenEnrichmentClient.clearCache();
    }
  }

  /**
   * Get token cache size
   */
  getTokenCacheSize(): number {
    return this.tokenEnrichmentClient?.getCacheSize() || 0;
  }
}
export * from './types';
export * from './clients/graphql-client';
export * from './clients/token-enrichment';
export * from './core/pagination';
export * from './clients/smart-rewards-client';
export * from './core/smart-rewards';
export * from './core/calculations';
export * from './blockchain/onchain-claim';

// Export a default client instance
export const defaultCampaignClient = new CampaignClient();

/**
 * Main entry point when running as a standalone application
 */
export function main(): void {
  const app = SmartRewardsCampaignOps.getInstance();
  app.start();
}

// Auto-start when running directly (not when imported as module)
if (require.main === module) {
  main();
}
