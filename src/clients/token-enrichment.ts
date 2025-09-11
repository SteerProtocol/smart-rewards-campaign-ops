/**
 * Token enrichment client for fetching token metadata from RPC
 * Implements token metadata caching and ERC-20 symbol/decimals fetching
 */

import {
  TokenMetadata,
  TokenEnrichmentError,
  Campaign,
  JSONRPCRequest,
  JSONRPCResponse
} from '../types';

// ERC-20 function selectors
const ERC20_SYMBOL_SELECTOR = '0x95d89b41'; // symbol()
const ERC20_DECIMALS_SELECTOR = '0x313ce567'; // decimals()

export class TokenEnrichmentClient {
  private rpcUrl: string;
  private cache: Map<string, TokenMetadata>;
  private enableCache: boolean;

  constructor(rpcUrl: string, enableCache: boolean = true) {
    this.rpcUrl = rpcUrl;
    this.enableCache = enableCache;
    this.cache = new Map();
  }

  /**
   * Fetch token metadata (symbol and decimals) from RPC
   */
  async getTokenMetadata(tokenAddress: string, chainId: number): Promise<TokenMetadata> {
    const cacheKey = `${chainId}:${tokenAddress.toLowerCase()}`;
    
    // Check cache first
    if (this.enableCache && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      // Fetch symbol and decimals in parallel
      const [symbol, decimals] = await Promise.all([
        this.getTokenSymbol(tokenAddress),
        this.getTokenDecimals(tokenAddress)
      ]);

      const metadata: TokenMetadata = { symbol, decimals };

      // Cache the result
      if (this.enableCache) {
        this.cache.set(cacheKey, metadata);
      }

      return metadata;
    } catch (error) {
      throw new TokenEnrichmentError(
        `Failed to fetch token metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
        tokenAddress,
        chainId
      );
    }
  }

  /**
   * Fetch token symbol using eth_call
   */
  private async getTokenSymbol(tokenAddress: string): Promise<string> {
    try {
      const response = await this.ethCall(tokenAddress, ERC20_SYMBOL_SELECTOR);
      return this.decodeStringResponse(response);
    } catch (error) {
      console.warn(`Failed to fetch symbol for ${tokenAddress}, using fallback`);
      return 'UNKNOWN';
    }
  }

  /**
   * Fetch token decimals using eth_call
   */
  private async getTokenDecimals(tokenAddress: string): Promise<number> {
    try {
      const response = await this.ethCall(tokenAddress, ERC20_DECIMALS_SELECTOR);
      return this.decodeUint8Response(response);
    } catch (error) {
      console.warn(`Failed to fetch decimals for ${tokenAddress}, using fallback`);
      return 18; // Default to 18 decimals
    }
  }

  /**
   * Make an eth_call RPC request
   */
  private async ethCall(to: string, data: string): Promise<string> {
    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'eth_call',
      params: [
        {
          to: to.toLowerCase(),
          data
        },
        'latest'
      ]
    };

    const response = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`RPC request failed: ${response.status} ${response.statusText}`);
    }

    const result: JSONRPCResponse = await response.json() as JSONRPCResponse;

    if (result.error) {
      throw new Error(`RPC error: ${result.error.message}`);
    }

    if (!result.result) {
      throw new Error('No result in RPC response');
    }

    return result.result;
  }

  /**
   * Decode a string response from eth_call
   */
  private decodeStringResponse(hexResponse: string): string {
    try {
      // Remove 0x prefix
      const hex = hexResponse.startsWith('0x') ? hexResponse.slice(2) : hexResponse;
      
      // Skip the first 64 characters (offset and length)
      const stringHex = hex.slice(128);
      
      // Convert hex to string, removing null bytes
      let result = '';
      for (let i = 0; i < stringHex.length; i += 2) {
        const byte = parseInt(stringHex.substr(i, 2), 16);
        if (byte !== 0) {
          result += String.fromCharCode(byte);
        }
      }
      
      return result || 'UNKNOWN';
    } catch (error) {
      return 'UNKNOWN';
    }
  }

  /**
   * Decode a uint8 response from eth_call
   */
  private decodeUint8Response(hexResponse: string): number {
    try {
      // Remove 0x prefix and get last byte (uint8)
      const hex = hexResponse.startsWith('0x') ? hexResponse.slice(2) : hexResponse;
      const lastByte = hex.slice(-2);
      return parseInt(lastByte, 16);
    } catch (error) {
      return 18; // Default to 18 decimals
    }
  }

  /**
   * Enrich campaigns with token symbols
   */
  async enrichCampaigns(campaigns: Campaign[]): Promise<Campaign[]> {
    const enrichedCampaigns: Campaign[] = [];

    for (const campaign of campaigns) {
      try {
        const metadata = await this.getTokenMetadata(
          campaign.rewardToken.id,
          campaign.chainId
        );

        const enrichedCampaign: Campaign = {
          ...campaign,
          campaignTokenSymbol: metadata.symbol
        };

        enrichedCampaigns.push(enrichedCampaign);
      } catch (error) {
        console.warn(
          `Failed to enrich campaign ${campaign.id} with token metadata:`,
          error instanceof Error ? error.message : error
        );
        // Include campaign without enrichment
        enrichedCampaigns.push(campaign);
      }
    }

    return enrichedCampaigns;
  }

  /**
   * Clear the metadata cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    keys: string[];
    enabled: boolean;
  } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      enabled: this.enableCache
    };
  }

  /**
   * Pre-warm cache with token metadata
   */
  async preWarmCache(tokens: Array<{ address: string; chainId: number }>): Promise<void> {
    const promises = tokens.map(token => 
      this.getTokenMetadata(token.address, token.chainId).catch(error => {
        console.warn(`Failed to pre-warm cache for ${token.address}:`, error);
      })
    );

    await Promise.allSettled(promises);
  }

  /**
   * Update RPC URL
   */
  updateRpcUrl(rpcUrl: string): void {
    this.rpcUrl = rpcUrl;
  }

  /**
   * Enable/disable caching
   */
  setCacheEnabled(enabled: boolean): void {
    this.enableCache = enabled;
    if (!enabled) {
      this.clearCache();
    }
  }
}
