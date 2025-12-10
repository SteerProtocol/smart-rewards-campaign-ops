/**
 * TypeScript types for the Campaigns API
 * Based on the GraphQL schema and API specification
 */

export interface Token {
  id: string;
  name: string;
  symbol: string;
  decimals: number;
}

export interface APR {
  apr1d: number;
  apr7d: number;
  apr14d: number;
  latestTvlUsd?: number;
  calculationTimestamp: string;
}

export interface Pool {
  id: string;
  feeTier: string;
  chainId: number;
  poolAddress: string;
  token0: Token;
  token1: Token;
}

export interface Campaign {
  id: string;
  chainId: number;
  rewardToken: Token;
  apr: APR;
  pool: Pool;
  startBlock: number;
  endBlock: number;
  distributionAmount: string;
  abandonedDeadline: number;
  cumulativeAllocated: number;
  lastBlockUpdatedTo: number;
  paused: boolean;
  closed: boolean;
  ipfsHash: string;
  ponderDbIdentifier: string;
  campaignStartTimestamp: string;
  campaignEndTimestamp: string;
  executionBundle: string;
  executionParams: string;
  desc: string;
  createdAt: string;
  updatedAt: string;
  campaignEventId: string;
  campaignId: number;
  campaignType: string;
  name: string;
  protocol: string;
  liquidityPool: string;
  // Optional enriched field
  campaignTokenSymbol?: string;
}

export interface PageInfo {
  endCursor: string;
  hasNextPage: boolean;
}

export interface CampaignsEdge {
  node: Campaign;
}

export interface CampaignsResponse {
  campaigns: {
    edges: CampaignsEdge[];
    pageInfo: PageInfo;
    totalCount: number;
  };
}

export interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
  }>;
}

export interface CampaignFilter {
  chainId: number;
}

export interface CampaignsQueryVariables {
  first: number;
  after?: string | null;
  filter: CampaignFilter;
}

export interface GraphQLRequest {
  query: string;
  variables: CampaignsQueryVariables;
  operationName: string;
}

export interface FetchCampaignsResult {
  chainId: number;
  totalCount: number;
  pageInfo: PageInfo;
  campaigns: Campaign[];
}

export interface JSONRPCRequest {
  jsonrpc: string;
  id: number;
  method: string;
  params: any[];
}

export interface JSONRPCResponse {
  jsonrpc: string;
  id: number;
  result?: string;
  error?: {
    code: number;
    message: string;
  };
}

export interface TokenMetadata {
  symbol: string;
  decimals: number;
}

export interface EnrichmentOptions {
  enableTokenEnrichment?: boolean;
  rpcUrl?: string;
  cacheTokenMetadata?: boolean;
}

export interface CampaignFetchOptions {
  pageSize?: number;
  enrichment?: EnrichmentOptions;
}

// Campaign types enum for better type safety
export enum CampaignType {
  LIQUIDITY_PROVISION_REWARDS = 'liquidity_provision_rewards',
  TOKEN_BALANCE_REWARDS = 'token_balance_rewards'
}

// Error types
export class CampaignAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'CampaignAPIError';
  }
}

export class GraphQLError extends Error {
  constructor(
    message: string,
    public errors: Array<{ message: string; locations?: any; path?: any }>
  ) {
    super(message);
    this.name = 'GraphQLError';
  }
}

export class TokenEnrichmentError extends Error {
  constructor(
    message: string,
    public tokenAddress: string,
    public chainId: number
  ) {
    super(message);
    this.name = 'TokenEnrichmentError';
  }
}

// Smart Rewards Types

export interface ClaimProof {
  chainId: number;
  lastBlockUpdatedTo: number;
  user: string;
  campaignId: number;
  amount: string; // decimal string
  proof: string[]; // bytes32[] hex strings
}

export interface ClaimProofEdge {
  cursor: string;
  node: ClaimProof;
}

export interface ClaimProofsResponse {
  claimProofs: {
    totalCount: number;
    edges: ClaimProofEdge[];
    pageInfo: PageInfo;
  };
}

export interface ClaimReward {
  id: string;
  user: string;
  amount: string; // decimal string
  campaign: string; // campaignId as string
  chainId: number;
  timestamp: number; // Unix epoch seconds
}

export interface ClaimRewardEdge {
  cursor: string;
  node: ClaimReward;
}

export interface ClaimRewardsResponse {
  claimRewards: {
    totalCount: number;
    edges: ClaimRewardEdge[];
    pageInfo: PageInfo;
  };
}

export interface ClaimProofFilter {
  chainId: number;
  campaignId: number;
}

export interface ClaimRewardFilter {
  user: string;
}

export interface ClaimProofQueryVariables {
  user: string;
  filter: ClaimProofFilter;
  after?: string | null;
}

export interface ClaimRewardQueryVariables {
  pool: string;
  chainId: number;
  filter: ClaimRewardFilter;
  after?: string | null;
}

export interface SmartRewarderClaimArgs {
  users: string[];
  campaignIds: number[];
  amounts: string[]; // base units as strings
  proofs: string[][]; // bytes32[][]
}

export interface ClaimCalculations {
  totalEligible: string; // base units
  totalClaimed: string; // base units
  remaining: string; // base units
  canClaim: boolean;
}

export interface SmartRewardsResult {
  user: string;
  chainId: number;
  campaign: Campaign;
  proofs: ClaimProof[];
  historicalClaims: ClaimReward[];
  rewardsData: UserCampaignRewardTotal;
}

export interface SmartRewarderConfig {
  [chainId: number]: string; // SmartRewarder contract address
}

// Smart Rewards Error Types
export class SmartRewardsError extends Error {
  constructor(
    message: string,
    public user?: string,
    public campaignId?: number,
    public chainId?: number
  ) {
    super(message);
    this.name = 'SmartRewardsError';
  }
}

export class ClaimError extends Error {
  constructor(
    message: string,
    public revertReason?: string,
    public transactionHash?: string
  ) {
    super(message);
    this.name = 'ClaimError';
  }
}

// User Campaign Reward Total Types
export interface UserCampaignRewardTotal {
  campaignId: string;
  chainId: number;
  count: number;
  rewardToken: string;
  totalAmount: string; // decimal string
  user: string;
  totalClaimed?: string;
}

export interface UserCampaignRewardTotalResponse {
  userCampaignRewardTotal: UserCampaignRewardTotal;
}

export interface UserCampaignRewardTotalQueryVariables {
  user: string;
  campaignId: string;
  chainId: number;
}

// Campaign Creation Types

export interface CampaignCreationConfig {
  chainId: number;
  rpcUrl: string;
  smartRewardsAddress: string;
  useLegacyTx?: boolean;
}

export interface WalletConfig {
  identityFile: string;
  passphrase: string;
}

export interface CampaignMetadata {
  name: string;
  description: string;
  protocol: string;
  category: string;
  campaignType: string;
  execution_bundle: string;
  execution_parameters?: Record<string, any>;
  epochLength?: number;
  rewarderType?: string;
}

export interface CampaignCreationResult {
  transactionHash: string;
  blockNumber: number;
  gasUsed: string;
  campaignId?: string;
  startTimestamp: number;
  endTimestamp: number;
  escrowAmount: string;
  ipfsHash: string;
}

export class CampaignCreationError extends Error {
  constructor(
    message: string,
    public errorCode: string,
    public originalError?: any
  ) {
    super(message);
    this.name = 'CampaignCreationError';
  }
}
