/**
 * GraphQL client for the Campaigns API
 * Handles GraphQL requests to the campaigns service
 */

import {
  GraphQLRequest,
  GraphQLResponse,
  CampaignsResponse,
  CampaignsQueryVariables,
  CampaignAPIError,
  GraphQLError
} from '../types';

const GRAPHQL_ENDPOINT = 'https://s55qpiwei1.execute-api.us-east-1.amazonaws.com';

// const GRAPHQL_ENDPOINT = 'http://localhost:5000/';

const CAMPAIGNS_QUERY = `
query CampaignsQuery($first: Int, $after: String, $filter: CampaignFilter) {
  campaigns(first: $first, after: $after, filter: $filter) {
    edges {
      node {
        id
        chainId
        rewardToken { id name symbol decimals }
        apr { apr1d apr7d apr14d latestTvlUsd calculationTimestamp }
        pool {
          id
          feeTier
          chainId
          poolAddress
          token0 { id name symbol decimals }
          token1 { id name symbol decimals }
        }
        startBlock
        endBlock
        distributionAmount
        abandonedDeadline
        cumulativeAllocated
        lastBlockUpdatedTo
        paused
        closed
        ipfsHash
        chainId
        ponderDbIdentifier
        campaignStartTimestamp
        campaignEndTimestamp
        executionBundle
        executionParams
        desc
        createdAt
        updatedAt
        campaignEventId
        campaignId
        campaignType
        name
        protocol
        liquidityPool
      }
    }
    pageInfo { endCursor hasNextPage }
    totalCount
  }
}`;

export class GraphQLClient {
  private endpoint: string;
  private headers: Record<string, string>;

  constructor(endpoint: string = GRAPHQL_ENDPOINT) {
    this.endpoint = endpoint;
    this.headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  /**
   * Execute a GraphQL request
   */
  async request<T>(
    query: string,
    variables: any = {},
    operationName?: string
  ): Promise<GraphQLResponse<T>> {
    const payload: GraphQLRequest = {
      query,
      variables,
      operationName: operationName || ''
    };

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new CampaignAPIError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          errorText
        );
      }

      const result: GraphQLResponse<T> = await response.json() as GraphQLResponse<T>;

      // Handle GraphQL errors
      if (result.errors && result.errors.length > 0) {
        throw new GraphQLError(
          `GraphQL errors: ${result.errors.map(e => e.message).join(', ')}`,
          result.errors
        );
      }

      return result;
    } catch (error) {
      if (error instanceof CampaignAPIError || error instanceof GraphQLError) {
        throw error;
      }

      // Handle network/fetch errors
      throw new CampaignAPIError(
        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        error
      );
    }
  }

  /**
   * Fetch campaigns using the CampaignsQuery
   */
  async fetchCampaigns(variables: CampaignsQueryVariables): Promise<CampaignsResponse> {
    const response = await this.request<CampaignsResponse>(
      CAMPAIGNS_QUERY,
      variables,
      'CampaignsQuery'
    );

    if (!response.data) {
      throw new CampaignAPIError('No data received from GraphQL response');
    }

    return response.data;
  }

  /**
   * Fetch a single page of campaigns
   */
  async fetchCampaignsPage(
    chainId: number,
    pageSize: number = 50,
    cursor?: string | null
  ): Promise<CampaignsResponse> {
    const variables: CampaignsQueryVariables = {
      first: pageSize,
      after: cursor,
      filter: { chainId }
    };

    return this.fetchCampaigns(variables);
  }

  /**
   * Set custom headers for requests
   */
  setHeaders(headers: Record<string, string>): void {
    this.headers = { ...this.headers, ...headers };
  }

  /**
   * Get current endpoint
   */
  getEndpoint(): string {
    return this.endpoint;
  }
}

// Export a default instance
export const defaultGraphQLClient = new GraphQLClient();
