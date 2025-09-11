/**
 * Comprehensive error handling and validation utilities
 * Implements error handling as specified in the API documentation
 */

import {
  CampaignAPIError,
  GraphQLError,
  TokenEnrichmentError,
  Campaign,
  PageInfo
} from '../types';

export interface ErrorContext {
  operation: string;
  chainId?: number;
  page?: number;
  tokenAddress?: string;
  campaignId?: string;
  timestamp: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorLog: Array<{ error: Error; context: ErrorContext }> = [];
  private maxLogSize: number;

  constructor(maxLogSize: number = 1000) {
    this.maxLogSize = maxLogSize;
  }

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Log an error with context
   */
  logError(error: Error, context: Partial<ErrorContext>): void {
    const fullContext: ErrorContext = {
      operation: 'unknown',
      timestamp: new Date().toISOString(),
      ...context
    };

    this.errorLog.push({ error, context: fullContext });

    // Maintain log size limit
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxLogSize);
    }

    // Log to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[CampaignAPI] ${fullContext.operation}:`, error.message, fullContext);
    }
  }

  /**
   * Handle and classify different types of errors
   */
  handleError(error: unknown, context: Partial<ErrorContext>): Error {
    const operation = context.operation || 'unknown';

    if (error instanceof CampaignAPIError) {
      this.logError(error, context);
      return error;
    }

    if (error instanceof GraphQLError) {
      this.logError(error, context);
      return new CampaignAPIError(
        `GraphQL operation failed: ${error.message}`,
        undefined,
        error
      );
    }

    if (error instanceof TokenEnrichmentError) {
      this.logError(error, context);
      return new CampaignAPIError(
        `Token enrichment failed: ${error.message}`,
        undefined,
        error
      );
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
      const networkError = new CampaignAPIError(
        `Network error during ${operation}: Check your internet connection`,
        undefined,
        error
      );
      this.logError(networkError, context);
      return networkError;
    }

    if (error instanceof SyntaxError) {
      const parseError = new CampaignAPIError(
        `Response parsing error during ${operation}: Invalid JSON response`,
        undefined,
        error
      );
      this.logError(parseError, context);
      return parseError;
    }

    // Handle unknown errors
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    const unknownError = new CampaignAPIError(
      `Unexpected error during ${operation}: ${message}`,
      undefined,
      error
    );
    this.logError(unknownError, context);
    return unknownError;
  }

  /**
   * Get recent errors
   */
  getRecentErrors(limit: number = 10): Array<{ error: Error; context: ErrorContext }> {
    return this.errorLog.slice(-limit);
  }

  /**
   * Clear error log
   */
  clearErrorLog(): void {
    this.errorLog = [];
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    total: number;
    byType: Record<string, number>;
    byOperation: Record<string, number>;
  } {
    const stats = {
      total: this.errorLog.length,
      byType: {} as Record<string, number>,
      byOperation: {} as Record<string, number>
    };

    this.errorLog.forEach(({ error, context }) => {
      const errorType = error.constructor.name;
      stats.byType[errorType] = (stats.byType[errorType] || 0) + 1;
      stats.byOperation[context.operation] = (stats.byOperation[context.operation] || 0) + 1;
    });

    return stats;
  }
}

export class Validator {
  /**
   * Validate chainId parameter
   */
  static validateChainId(chainId: number): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!chainId) {
      errors.push('ChainId is required');
    } else if (!Number.isInteger(chainId)) {
      errors.push('ChainId must be an integer');
    } else if (chainId <= 0) {
      errors.push('ChainId must be positive');
    } else if (chainId > 999999) {
      warnings.push('ChainId seems unusually high, please verify');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate page size parameter
   */
  static validatePageSize(pageSize: number): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!Number.isInteger(pageSize)) {
      errors.push('Page size must be an integer');
    } else if (pageSize <= 0) {
      errors.push('Page size must be positive');
    } else if (pageSize > 1000) {
      errors.push('Page size cannot exceed 1000');
    } else if (pageSize > 100) {
      warnings.push('Large page sizes may impact performance');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate RPC URL
   */
  static validateRpcUrl(rpcUrl: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!rpcUrl) {
      errors.push('RPC URL is required');
      return { isValid: false, errors, warnings };
    }

    try {
      const url = new URL(rpcUrl);
      if (!['http:', 'https:'].includes(url.protocol)) {
        errors.push('RPC URL must use HTTP or HTTPS protocol');
      }
    } catch {
      errors.push('Invalid RPC URL format');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate Ethereum address
   */
  static validateEthereumAddress(address: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!address) {
      errors.push('Address is required');
    } else if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      errors.push('Invalid Ethereum address format');
    } else if (address === address.toLowerCase() || address === address.toUpperCase()) {
      warnings.push('Address is not checksummed');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate campaign data integrity
   */
  static validateCampaign(campaign: Campaign): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!campaign.id) errors.push('Campaign ID is missing');
    if (!campaign.chainId) errors.push('Chain ID is missing');
    if (!campaign.name) errors.push('Campaign name is missing');
    if (!campaign.campaignType) errors.push('Campaign type is missing');

    // Validate addresses
    if (campaign.liquidityPool) {
      const addressValidation = Validator.validateEthereumAddress(campaign.liquidityPool);
      if (!addressValidation.isValid) {
        errors.push(`Invalid liquidityPool address: ${addressValidation.errors.join(', ')}`);
      }
    }

    // Validate blocks
    if (campaign.startBlock && campaign.endBlock) {
      if (campaign.startBlock >= campaign.endBlock) {
        errors.push('Start block must be before end block');
      }
    }

    // Validate timestamps
    if (campaign.campaignStartTimestamp && campaign.campaignEndTimestamp) {
      const startTime = parseInt(campaign.campaignStartTimestamp);
      const endTime = parseInt(campaign.campaignEndTimestamp);
      if (startTime >= endTime) {
        errors.push('Start timestamp must be before end timestamp');
      }
    }

    // Validate distribution amount
    if (campaign.distributionAmount) {
      const amount = parseFloat(campaign.distributionAmount);
      if (isNaN(amount) || amount < 0) {
        errors.push('Invalid distribution amount');
      }
    }

    // Warnings for potentially problematic data
    if (campaign.paused) {
      warnings.push('Campaign is paused');
    }
    if (campaign.closed) {
      warnings.push('Campaign is closed');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate page info consistency
   */
  static validatePageInfo(pageInfo: PageInfo, campaignsCount: number): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (pageInfo.hasNextPage && !pageInfo.endCursor) {
      errors.push('hasNextPage is true but endCursor is missing');
    }

    if (!pageInfo.hasNextPage && pageInfo.endCursor) {
      warnings.push('endCursor provided but hasNextPage is false');
    }

    if (campaignsCount === 0 && pageInfo.hasNextPage) {
      warnings.push('No campaigns in page but hasNextPage is true');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate complete fetch result
   */
  static validateFetchResult(
    result: {
      chainId: number;
      totalCount: number;
      pageInfo: PageInfo;
      campaigns: Campaign[];
    }
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate basic structure
    const chainIdValidation = Validator.validateChainId(result.chainId);
    errors.push(...chainIdValidation.errors);
    warnings.push(...chainIdValidation.warnings);

    // Validate counts
    if (result.totalCount < 0) {
      errors.push('Total count cannot be negative');
    }

    if (result.campaigns.length > result.totalCount) {
      errors.push('Campaigns count exceeds total count');
    }

    // Validate page info
    const pageInfoValidation = Validator.validatePageInfo(result.pageInfo, result.campaigns.length);
    errors.push(...pageInfoValidation.errors);
    warnings.push(...pageInfoValidation.warnings);

    // Validate individual campaigns
    result.campaigns.forEach((campaign, index) => {
      const campaignValidation = Validator.validateCampaign(campaign);
      if (!campaignValidation.isValid) {
        errors.push(`Campaign ${index}: ${campaignValidation.errors.join(', ')}`);
      }
      if (campaignValidation.warnings.length > 0) {
        warnings.push(`Campaign ${index}: ${campaignValidation.warnings.join(', ')}`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();
