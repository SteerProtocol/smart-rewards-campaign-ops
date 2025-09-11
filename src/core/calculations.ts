/**
 * Client-side calculations for smart rewards
 * Implements the derivations specified in the API documentation
 */

import { ClaimProof, ClaimReward, ClaimCalculations, SmartRewardsError } from '../types';

/**
 * Utility class for reward calculations and unit conversions
 */
export class RewardCalculator {
  /**
   * Convert decimal string to base units (wei equivalent)
   * @param decimalAmount - Amount as decimal string (e.g., "12.345")
   * @param decimals - Token decimals (e.g., 18 for most ERC-20)
   * @returns Base units as string (e.g., "12345000000000000000")
   */
  static toBaseUnits(decimalAmount: string, decimals: number): string {
    if (!decimalAmount || isNaN(parseFloat(decimalAmount))) {
      throw new SmartRewardsError(`Invalid decimal amount: ${decimalAmount}`);
    }

    if (decimals < 0 || decimals > 77) { // 77 is max safe decimals in JavaScript
      throw new SmartRewardsError(`Invalid decimals: ${decimals}`);
    }

    try {
      // Handle the conversion safely without floating point precision issues
      const [whole, fractional = ''] = decimalAmount.split('.');
      
      // Pad or truncate fractional part to match decimals
      const paddedFractional = fractional.padEnd(decimals, '0').slice(0, decimals);
      
      // Combine whole and fractional parts
      const baseUnits = whole + paddedFractional;
      
      // Remove leading zeros but keep at least one digit
      const result = baseUnits.replace(/^0+/, '') || '0';
      
      // Validate result is a valid integer
      if (!/^\d+$/.test(result)) {
        throw new Error('Result is not a valid integer');
      }
      
      return result;
    } catch (error) {
      throw new SmartRewardsError(
        `Failed to convert ${decimalAmount} to base units with ${decimals} decimals: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Convert base units back to decimal string
   * @param baseUnits - Amount in base units (e.g., "12345000000000000000")
   * @param decimals - Token decimals (e.g., 18)
   * @returns Decimal string (e.g., "12.345")
   */
  static fromBaseUnits(baseUnits: string, decimals: number): string {
    if (!baseUnits || !/^\d+$/.test(baseUnits)) {
      throw new SmartRewardsError(`Invalid base units: ${baseUnits}`);
    }

    if (decimals < 0 || decimals > 77) {
      throw new SmartRewardsError(`Invalid decimals: ${decimals}`);
    }

    try {
      if (decimals === 0) {
        return baseUnits;
      }

      // Pad with leading zeros if needed
      const paddedBaseUnits = baseUnits.padStart(decimals + 1, '0');
      
      // Split into whole and fractional parts
      const wholePartLength = paddedBaseUnits.length - decimals;
      const wholePart = paddedBaseUnits.slice(0, wholePartLength) || '0';
      const fractionalPart = paddedBaseUnits.slice(wholePartLength);
      
      // Remove trailing zeros from fractional part
      const trimmedFractional = fractionalPart.replace(/0+$/, '');
      
      if (trimmedFractional === '') {
        return wholePart;
      }
      
      return `${wholePart}.${trimmedFractional}`;
    } catch (error) {
      throw new SmartRewardsError(
        `Failed to convert ${baseUnits} from base units with ${decimals} decimals: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Add two base unit amounts
   * @param amount1 - First amount in base units
   * @param amount2 - Second amount in base units
   * @returns Sum in base units
   */
  static addBaseUnits(amount1: string, amount2: string): string {
    try {
      // Simple string-based addition for very large numbers
      const num1 = BigInt(amount1);
      const num2 = BigInt(amount2);
      return (num1 + num2).toString();
    } catch (error) {
      throw new SmartRewardsError(
        `Failed to add base units ${amount1} + ${amount2}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Subtract two base unit amounts
   * @param amount1 - Amount to subtract from
   * @param amount2 - Amount to subtract
   * @returns Difference in base units (minimum 0)
   */
  static subtractBaseUnits(amount1: string, amount2: string): string {
    try {
      const num1 = BigInt(amount1);
      const num2 = BigInt(amount2);
      const result = num1 - num2;
      return result < BigInt(0) ? '0' : result.toString();
    } catch (error) {
      throw new SmartRewardsError(
        `Failed to subtract base units ${amount1} - ${amount2}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Compare two base unit amounts
   * @param amount1 - First amount
   * @param amount2 - Second amount
   * @returns -1 if amount1 < amount2, 0 if equal, 1 if amount1 > amount2
   */
  static compareBaseUnits(amount1: string, amount2: string): number {
    try {
      const num1 = BigInt(amount1);
      const num2 = BigInt(amount2);
      if (num1 < num2) return -1;
      if (num1 > num2) return 1;
      return 0;
    } catch (error) {
      throw new SmartRewardsError(
        `Failed to compare base units ${amount1} and ${amount2}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Calculate total eligible amount from claim proofs
   * @param proofs - Array of claim proofs for the campaign
   * @param decimals - Token decimals for conversion
   * @returns Total eligible amount in base units
   */
  static calculateTotalEligible(proofs: ClaimProof[], decimals: number): string {
    try {
      let total = '0';
      
      for (const proof of proofs) {
        const baseUnits = RewardCalculator.toBaseUnits(proof.amount, decimals);
        total = RewardCalculator.addBaseUnits(total, baseUnits);
      }
      
      return total;
    } catch (error) {
      throw new SmartRewardsError(
        `Failed to calculate total eligible: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Calculate total claimed amount from historical claims
   * @param claims - Array of historical claims for the campaign
   * @param campaignId - Campaign ID to filter by
   * @param decimals - Token decimals for conversion
   * @returns Total claimed amount in base units
   */
  static calculateTotalClaimed(claims: ClaimReward[], campaignId: number, decimals: number): string {
    try {
      let total = '0';
      
      // Filter claims for this specific campaign
      const campaignClaims = claims.filter(claim => Number(claim.campaign) === campaignId);
      
      for (const claim of campaignClaims) {
        const baseUnits = RewardCalculator.toBaseUnits(claim.amount, decimals);
        total = RewardCalculator.addBaseUnits(total, baseUnits);
      }
      
      return total;
    } catch (error) {
      throw new SmartRewardsError(
        `Failed to calculate total claimed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Calculate remaining claimable amount
   * @param totalEligible - Total eligible in base units
   * @param totalClaimed - Total claimed in base units
   * @returns Remaining claimable amount in base units
   */
  static calculateRemaining(totalEligible: string, totalClaimed: string): string {
    return RewardCalculator.subtractBaseUnits(totalEligible, totalClaimed);
  }

  /**
   * Perform complete calculations for a campaign
   * @param proofs - Claim proofs for the campaign
   * @param claims - Historical claims for the user
   * @param campaignId - Campaign ID
   * @param decimals - Token decimals
   * @returns Complete calculation results
   */
  static performCalculations(
    proofs: ClaimProof[],
    claims: ClaimReward[],
    campaignId: number,
    decimals: number
  ): ClaimCalculations {
    try {
      const totalEligible = RewardCalculator.calculateTotalEligible(proofs, decimals);
      const totalClaimed = RewardCalculator.calculateTotalClaimed(claims, campaignId, decimals);
      const remaining = RewardCalculator.calculateRemaining(totalEligible, totalClaimed);
      
      const canClaim = RewardCalculator.compareBaseUnits(remaining, '0') > 0;

      return {
        totalEligible,
        totalClaimed,
        remaining,
        canClaim
      };
    } catch (error) {
      throw new SmartRewardsError(
        `Failed to perform calculations for campaign ${campaignId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Format calculations for human-readable display
   * @param calculations - Calculation results
   * @param decimals - Token decimals
   * @returns Human-readable calculation results
   */
  static formatCalculations(calculations: ClaimCalculations, decimals: number): {
    totalEligible: string;
    totalClaimed: string;
    remaining: string;
    canClaim: boolean;
  } {
    return {
      totalEligible: RewardCalculator.fromBaseUnits(calculations.totalEligible, decimals),
      totalClaimed: RewardCalculator.fromBaseUnits(calculations.totalClaimed, decimals),
      remaining: RewardCalculator.fromBaseUnits(calculations.remaining, decimals),
      canClaim: calculations.canClaim
    };
  }

  /**
   * Validate claim proofs for consistency
   * @param proofs - Array of claim proofs
   * @param expectedUser - Expected user address
   * @param expectedCampaignId - Expected campaign ID
   */
  static validateClaimProofs(proofs: ClaimProof[], expectedUser: string, expectedCampaignId: number): void {
    for (const proof of proofs) {
      if (proof.user.toLowerCase() !== expectedUser.toLowerCase()) {
        throw new SmartRewardsError(
          `Proof user mismatch: expected ${expectedUser}, got ${proof.user}`
        );
      }
      
      if (proof.campaignId !== expectedCampaignId) {
        throw new SmartRewardsError(
          `Proof campaign mismatch: expected ${expectedCampaignId}, got ${proof.campaignId}`
        );
      }
      
      if (!proof.proof || proof.proof.length === 0) {
        throw new SmartRewardsError('Empty proof array found');
      }
      
      if (!proof.amount || parseFloat(proof.amount) <= 0) {
        throw new SmartRewardsError(`Invalid proof amount: ${proof.amount}`);
      }
    }
  }

  /**
   * Validate historical claims for consistency
   * @param claims - Array of historical claims
   * @param expectedUser - Expected user address
   */
  static validateHistoricalClaims(claims: ClaimReward[], expectedUser: string): void {
    for (const claim of claims) {
      if (claim.user.toLowerCase() !== expectedUser.toLowerCase()) {
        throw new SmartRewardsError(
          `Claim user mismatch: expected ${expectedUser}, got ${claim.user}`
        );
      }
      
      if (!claim.amount || parseFloat(claim.amount) <= 0) {
        throw new SmartRewardsError(`Invalid claim amount: ${claim.amount}`);
      }
      
      if (!claim.campaign || isNaN(Number(claim.campaign))) {
        throw new SmartRewardsError(`Invalid campaign ID in claim: ${claim.campaign}`);
      }
    }
  }

  /**
   * Check if amounts are safe for on-chain use (no overflow)
   * @param amounts - Array of amounts in base units
   * @returns True if all amounts are safe
   */
  static validateAmountsForOnChain(amounts: string[]): boolean {
    const MAX_UINT256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
    
    try {
      for (const amount of amounts) {
        const value = BigInt(amount);
        if (value < BigInt(0) || value > MAX_UINT256) {
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }
}
