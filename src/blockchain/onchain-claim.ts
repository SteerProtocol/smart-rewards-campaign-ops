/**
 * On-chain claim functionality for SmartRewarder contract
 * Implements the contract interaction specification
 */

import { ethers } from 'ethers';
import {
  ClaimProof,
  SmartRewarderClaimArgs,
  SmartRewarderConfig,
  ClaimError,
  SmartRewardsError
} from '../types';
import { RewardCalculator } from '../core/calculations';

// SmartRewarder ABI (minimal for claim function)
const SMART_REWARDER_ABI = [
  {
    "inputs": [
      {
        "internalType": "address[]",
        "name": "users",
        "type": "address[]"
      },
      {
        "internalType": "uint256[]",
        "name": "campaignIds",
        "type": "uint256[]"
      },
      {
        "internalType": "uint256[]",
        "name": "amounts",
        "type": "uint256[]"
      },
      {
        "internalType": "bytes32[][]",
        "name": "proofs",
        "type": "bytes32[][]"
      }
    ],
    "name": "claim",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "campaignId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "Claimed",
    "type": "event"
  }
];

export interface ClaimTransactionResult {
  transactionHash: string;
  blockNumber: number;
  gasUsed: string;
  effectiveGasPrice: string;
  status: number;
  events: ClaimEvent[];
}

export interface ClaimEvent {
  user: string;
  campaignId: number;
  amount: string;
}

export interface ClaimOptions {
  gasLimit?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: number;
}

export class OnChainClaimClient {
  private provider: ethers.JsonRpcProvider;
  private signer: ethers.Signer;
  private smartRewarderConfig: SmartRewarderConfig;

  constructor(
    provider: ethers.JsonRpcProvider,
    signer: ethers.Signer,
    smartRewarderConfig: SmartRewarderConfig
  ) {
    this.provider = provider;
    this.signer = signer;
    this.smartRewarderConfig = smartRewarderConfig;
  }

  /**
   * Get SmartRewarder contract for a specific chain
   */
  private getSmartRewarderContract(chainId: number): ethers.Contract {
    const contractAddress = this.smartRewarderConfig[chainId];
    if (!contractAddress) {
      throw new ClaimError(`No SmartRewarder contract configured for chain ${chainId}`);
    }

    return new ethers.Contract(contractAddress, SMART_REWARDER_ABI, this.signer);
  }

  /**
   * Prepare claim arguments from proofs
   */
  prepareClaimArgs(proofs: ClaimProof[]): SmartRewarderClaimArgs {
    if (proofs.length === 0) {
      throw new ClaimError('No proofs provided for claim');
    }

    try {
      const users: string[] = [];
      const campaignIds: number[] = [];
      const amounts: string[] = [];
      const proofArrays: string[][] = [];

      for (const proof of proofs) {
        // Validate proof structure
        if (!proof.user || !proof.proof || proof.proof.length === 0) {
          throw new ClaimError(`Invalid proof structure for campaign ${proof.campaignId}`);
        }

        // Convert amount to base units
        users.push(proof.user);
        campaignIds.push(proof.campaignId);
        amounts.push(proof.amount);
        proofArrays.push(proof.proof);
      }

      // Validate array lengths are consistent
      if (users.length !== campaignIds.length || 
          users.length !== amounts.length || 
          users.length !== proofArrays.length) {
        throw new ClaimError('Inconsistent array lengths in claim arguments');
      }

      // Validate amounts are safe for on-chain use
      if (!RewardCalculator.validateAmountsForOnChain(amounts)) {
        throw new ClaimError('One or more amounts exceed safe limits for on-chain use');
      }

      return {
        users,
        campaignIds,
        amounts,
        proofs: proofArrays
      };
    } catch (error) {
      if (error instanceof ClaimError) {
        throw error;
      }
      throw new ClaimError(
        `Failed to prepare claim arguments: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Estimate gas for claim transaction
   */
  async estimateClaimGas(
    chainId: number,
    claimArgs: SmartRewarderClaimArgs
  ): Promise<string> {
    try {
      const contract = this.getSmartRewarderContract(chainId);
      // @ts-ignore
      const gasEstimate = await contract.estimateGas.claim(
        claimArgs.users,
        claimArgs.campaignIds,
        claimArgs.amounts,
        claimArgs.proofs
      );
      
      // Add 20% buffer to gas estimate
      const gasWithBuffer = gasEstimate.mul(120).div(100);
      return gasWithBuffer.toString();
    } catch (error) {
      throw new ClaimError(
        `Failed to estimate gas: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Execute claim transaction
   */
  async executeClaim(
    chainId: number,
    claimArgs: SmartRewarderClaimArgs,
  ): Promise<ClaimTransactionResult> {
    try {
      const contract = this.getSmartRewarderContract(chainId);

      // Prepare transaction options

      // Execute the claim transaction
      const tx = await contract.claim(
        claimArgs.users,
        claimArgs.campaignIds,
        claimArgs.amounts,
        claimArgs.proofs,
      );

      // Wait for transaction confirmation
      const receipt = await tx.wait();

      if (receipt.status !== 1) {
        throw new ClaimError(
          `Transaction failed with status ${receipt.status}`,
          'TransactionFailed',
          receipt.transactionHash
        );
      }

      // Parse claim events
      const events = this.parseClaimEvents(receipt, contract);

      return {
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: receipt.effectiveGasPrice?.toString() || '0',
        status: receipt.status,
        events
      };

    } catch (error) {
      if (error instanceof ClaimError) {
        throw error;
      }

      // Handle common revert reasons
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      let revertReason: string | undefined;

      if (errorMessage.includes('InvalidProof') || errorMessage.includes('MerkleProofInvalid')) {
        revertReason = 'InvalidProof';
      } else if (errorMessage.includes('AlreadyClaimed')) {
        revertReason = 'AlreadyClaimed';
      } else if (errorMessage.includes('CampaignClosed') || errorMessage.includes('ClaimWindowEnded')) {
        revertReason = 'CampaignClosed';
      } else if (errorMessage.includes('Unauthorized')) {
        revertReason = 'Unauthorized';
      }

      throw new ClaimError(
        `Claim transaction failed: ${errorMessage}`,
        revertReason,
        undefined
      );
    }
  }

  /**
   * Parse claim events from transaction receipt
   */
  private parseClaimEvents(receipt: ethers.ContractTransactionReceipt, contract: ethers.Contract): ClaimEvent[] {
    const events: ClaimEvent[] = [];

    try {
      for (const log of receipt.logs) {
        try {
          const parsedLog = contract.interface.parseLog(log);
          if (parsedLog?.name === 'Claimed') {
            events.push({
              user: parsedLog.args.user,
              campaignId: parsedLog.args.campaignId.toNumber(),
              amount: parsedLog.args.amount.toString()
            });
          }
        } catch {
          // Skip logs that can't be parsed (likely from other contracts)
          continue;
        }
      }
    } catch (error) {
      console.warn('Failed to parse claim events:', error);
    }

    return events;
  }

  /**
   * Create a single-proof claim
   */
  async claimSingle(
    chainId: number,
    proof: ClaimProof,
    decimals: number,
    options: ClaimOptions = {}
  ): Promise<ClaimTransactionResult> {
    const claimArgs = this.prepareClaimArgs([proof]);
    return this.executeClaim(chainId, claimArgs);
  }

  /**
   * Create a batch claim for multiple proofs
   */
  async claimBatch(
    chainId: number,
    proofs: ClaimProof[],
    decimals: number,
    options: ClaimOptions = {}
  ): Promise<ClaimTransactionResult> {
    if (proofs.length === 0) {
      throw new ClaimError('No proofs provided for batch claim');
    }

    const claimArgs = this.prepareClaimArgs(proofs);
    return this.executeClaim(chainId, claimArgs);
  }

  /**
   * Validate a proof can be claimed (basic checks)
   */
  validateProofForClaim(proof: ClaimProof, expectedUser: string): void {
    if (proof.user.toLowerCase() !== expectedUser.toLowerCase()) {
      throw new ClaimError(`Proof user ${proof.user} does not match expected user ${expectedUser}`);
    }

    if (!proof.proof || proof.proof.length === 0) {
      throw new ClaimError('Proof array is empty');
    }

    if (!proof.amount || parseFloat(proof.amount) <= 0) {
      throw new ClaimError(`Invalid proof amount: ${proof.amount}`);
    }

    if (proof.campaignId <= 0) {
      throw new ClaimError(`Invalid campaign ID: ${proof.campaignId}`);
    }
  }

  /**
   * Get contract address for a chain
   */
  getContractAddress(chainId: number): string {
    const address = this.smartRewarderConfig[chainId];
    if (!address) {
      throw new SmartRewardsError(`No SmartRewarder contract configured for chain ${chainId}`);
    }
    return address;
  }

  /**
   * Update SmartRewarder configuration
   */
  updateConfig(config: SmartRewarderConfig): void {
    this.smartRewarderConfig = { ...this.smartRewarderConfig, ...config };
  }
}


