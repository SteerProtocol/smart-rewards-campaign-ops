/**
 * Pagination utilities for handling cursor-based pagination
 * Implements the pagination procedure described in the API spec
 */

import { GraphQLClient } from '../clients/graphql-client';
import { 
  Campaign, 
  PageInfo, 
  CampaignsResponse,
  CampaignAPIError 
} from '../types';

export interface PaginationResult {
  campaigns: Campaign[];
  pageInfo: PageInfo;
  totalCount: number;
}

export interface PaginationOptions {
  pageSize?: number;
  maxPages?: number;
  onPageFetched?: (page: number, campaigns: Campaign[], hasMore: boolean) => void;
}

export class PaginationManager {
  private client: GraphQLClient;
  private defaultPageSize: number;

  constructor(client: GraphQLClient, defaultPageSize: number = 50) {
    this.client = client;
    this.defaultPageSize = defaultPageSize;
  }

  /**
   * Fetch all campaigns for a chain using cursor-based pagination
   */
  async fetchAllCampaigns(
    chainId: number,
    options: PaginationOptions = {}
  ): Promise<PaginationResult> {
    const {
      pageSize = this.defaultPageSize,
      maxPages = Infinity,
      onPageFetched
    } = options;

    const allCampaigns: Campaign[] = [];
    let cursor: string | null = null;
    let hasNextPage = true;
    let pageCount = 0;
    let finalPageInfo: PageInfo = { endCursor: '', hasNextPage: false };
    let totalCount = 0;

    try {
      while (hasNextPage && pageCount < maxPages) {
        pageCount++;

        // Fetch the current page
        const response: CampaignsResponse = await this.client.fetchCampaignsPage(
          chainId,
          pageSize,
          cursor
        );

        // Extract campaigns from edges
        const pageCampaigns = response.campaigns.edges.map(edge => edge.node);
        allCampaigns.push(...pageCampaigns);

        // Update pagination state
        finalPageInfo = response.campaigns.pageInfo;
        totalCount = response.campaigns.totalCount;
        hasNextPage = finalPageInfo.hasNextPage;
        cursor = finalPageInfo.endCursor;

        // Call the callback if provided
        if (onPageFetched) {
          onPageFetched(pageCount, pageCampaigns, hasNextPage);
        }

        // Safety check to prevent infinite loops
        if (!cursor && hasNextPage) {
          console.warn('hasNextPage is true but no cursor provided, stopping pagination');
          break;
        }
      }

      // If we stopped due to maxPages limit, update hasNextPage accordingly
      if (pageCount >= maxPages && hasNextPage) {
        finalPageInfo = {
          ...finalPageInfo,
          hasNextPage: true
        };
      }

      return {
        campaigns: allCampaigns,
        pageInfo: finalPageInfo,
        totalCount
      };

    } catch (error) {
      throw new CampaignAPIError(
        `Pagination failed at page ${pageCount}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        error
      );
    }
  }

  /**
   * Fetch campaigns with manual pagination control
   */
  async fetchCampaignsPage(
    chainId: number,
    cursor?: string | null,
    pageSize?: number
  ): Promise<{
    campaigns: Campaign[];
    pageInfo: PageInfo;
    totalCount: number;
    page: CampaignsResponse;
  }> {
    try {
      const response = await this.client.fetchCampaignsPage(
        chainId,
        pageSize || this.defaultPageSize,
        cursor
      );

      const campaigns = response.campaigns.edges.map(edge => edge.node);

      return {
        campaigns,
        pageInfo: response.campaigns.pageInfo,
        totalCount: response.campaigns.totalCount,
        page: response
      };
    } catch (error) {
      throw new CampaignAPIError(
        `Failed to fetch campaigns page: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        error
      );
    }
  }

  /**
   * Estimate total pages based on page size and total count
   */
  estimateTotalPages(totalCount: number, pageSize: number = this.defaultPageSize): number {
    return Math.ceil(totalCount / pageSize);
  }

  /**
   * Validate pagination parameters
   */
  validatePaginationParams(pageSize?: number, maxPages?: number): void {
    if (pageSize !== undefined && (pageSize <= 0 || pageSize > 1000)) {
      throw new Error('Page size must be between 1 and 1000');
    }

    if (maxPages !== undefined && maxPages <= 0) {
      throw new Error('Max pages must be greater than 0');
    }
  }

  /**
   * Create an async iterator for paginated results
   */
  async* iteratePages(
    chainId: number,
    pageSize: number = this.defaultPageSize
  ): AsyncIterableIterator<{
    campaigns: Campaign[];
    pageInfo: PageInfo;
    totalCount: number;
    pageNumber: number;
  }> {
    let cursor: string | null = null;
    let hasNextPage = true;
    let pageNumber = 0;

    while (hasNextPage) {
      pageNumber++;

      const result = await this.fetchCampaignsPage(chainId, cursor, pageSize);
      
      yield {
        campaigns: result.campaigns,
        pageInfo: result.pageInfo,
        totalCount: result.totalCount,
        pageNumber
      };

      hasNextPage = result.pageInfo.hasNextPage;
      cursor = result.pageInfo.endCursor;

      // Safety check
      if (!cursor && hasNextPage) {
        console.warn('hasNextPage is true but no cursor provided, stopping iteration');
        break;
      }
    }
  }

  /**
   * Fetch campaigns in chunks with a callback for each chunk
   */
  async processInChunks(
    chainId: number,
    processor: (campaigns: Campaign[], pageInfo: { page: number; total: number; hasMore: boolean }) => Promise<void> | void,
    options: PaginationOptions = {}
  ): Promise<void> {
    const { pageSize = this.defaultPageSize, maxPages = Infinity } = options;

    let pageNumber = 0;
    
    for await (const page of this.iteratePages(chainId, pageSize)) {
      pageNumber++;
      
      if (pageNumber > maxPages) {
        break;
      }

      await processor(page.campaigns, {
        page: pageNumber,
        total: page.totalCount,
        hasMore: page.pageInfo.hasNextPage
      });
    }
  }
}
