/**
 * Campaign Creation Module - Sonic Chain Support
 * 
 * This module provides functionality to create reward campaigns on blockchain networks,
 * with specialized support for Sonic (Chain ID: 146) and other EVM-compatible chains.
 * 
 * Features:
 * - Encrypted wallet management
 * - Token approval handling
 * - Campaign creation with timestamp-based rewards
 * - IPFS metadata integration
 * - Comprehensive error handling and validation
 */

import { ethers } from 'ethers';
import fs from 'fs';
import ERC20_ABI from '../abi/ERC20.json';
import SMART_REWARDS_TIMESTAMP_ABI from '../abi/SmartRewardsTimestamp.json';
import { 
  CampaignCreationConfig, 
  CampaignCreationResult, 
  CampaignCreationError,
  WalletConfig,
  CampaignMetadata
} from '../types';

/**
 * Campaign Creator Client
 * Handles the complete lifecycle of campaign creation on blockchain networks
 */
export class CampaignCreator {
  private provider: ethers.JsonRpcProvider;
  private wallet?: ethers.Wallet;
  private config: CampaignCreationConfig;

  constructor(config: CampaignCreationConfig) {
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
  }

  /**
   * Load and decrypt wallet from encrypted JSON file
   * If wallet file doesn't exist, creates a new one
   */
  async loadWallet(walletConfig: WalletConfig): Promise<void> {
    try {
      // Check if wallet file exists
      if (!fs.existsSync(walletConfig.identityFile)) {
        console.log('⚠️  Wallet file not found, creating a new wallet...');
        await this.createNewWallet(walletConfig);
        return;
      }

      // Load existing wallet
      const walletData = fs.readFileSync(walletConfig.identityFile, 'utf-8');
      const decryptedWallet = await ethers.Wallet.fromEncryptedJson(
        walletData,
        walletConfig.passphrase
      );
      this.wallet = decryptedWallet.connect(this.provider) as ethers.Wallet;
      
      console.log('✓ Wallet loaded successfully');
      console.log('  Address:', this.wallet.address);
      
      // Check balance
      const balance = await this.provider.getBalance(this.wallet.address);
      console.log('  Native balance:', ethers.formatEther(balance), 'tokens');
    } catch (error) {
      throw new CampaignCreationError(
        `Failed to load wallet: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'WalletLoadError'
      );
    }
  }

  /**
   * Create a new encrypted wallet and save it to file
   */
  private async createNewWallet(walletConfig: WalletConfig): Promise<void> {
    try {
      console.log('🔐 Generating new wallet...');
      
      // Generate a new random wallet
      const newWallet = ethers.Wallet.createRandom();
      
      console.log('✓ Wallet generated');
      console.log('  Address:', newWallet.address);
      console.log('  ⚠️  IMPORTANT: Save your private key and mnemonic securely!');
      console.log('  Private Key:', newWallet.privateKey);
      if (newWallet.mnemonic) {
        console.log('  Mnemonic:', newWallet.mnemonic.phrase);
      }
      console.log('');
      
      // Encrypt the wallet
      console.log('🔒 Encrypting wallet with passphrase...');
      const encryptedWallet = await newWallet.encrypt(walletConfig.passphrase);
      
      // Create directory if it doesn't exist
      const walletDir = walletConfig.identityFile.substring(0, walletConfig.identityFile.lastIndexOf('/'));
      if (walletDir && !fs.existsSync(walletDir)) {
        fs.mkdirSync(walletDir, { recursive: true });
        console.log('✓ Created directory:', walletDir);
      }
      
      // Save to file
      fs.writeFileSync(walletConfig.identityFile, encryptedWallet);
      console.log('✓ Wallet saved to:', walletConfig.identityFile);
      console.log('');
      console.log('⚠️  SECURITY REMINDERS:');
      console.log('  1. Fund this wallet with tokens before creating campaigns');
      console.log('  2. Never share your private key or mnemonic');
      console.log('  3. Keep your passphrase secure');
      console.log('  4. Backup the wallet file and credentials');
      console.log('');
      
      // Connect the wallet
      const connectedWallet = newWallet.connect(this.provider);
      // Create a new Wallet instance from the connected wallet to ensure proper type
      this.wallet = new ethers.Wallet(newWallet.privateKey, this.provider);
      
      // Check balance (will be 0 for new wallet)
      const balance = await this.provider.getBalance(this.wallet.address);
      console.log('  Native balance:', ethers.formatEther(balance), 'tokens');
      console.log('');
      console.log('💡 Next steps:');
      console.log('  1. Fund this address with native tokens for gas');
      console.log('  2. Fund this address with reward tokens for campaigns');
      console.log('  3. Run your campaign creation command again');
      console.log('');
      
    } catch (error) {
      throw new CampaignCreationError(
        `Failed to create new wallet: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'WalletCreationError'
      );
    }
  }

  /**
   * Approve SmartRewards contract to spend reward tokens
   */
  async approveTokens(
    rewardTokenAddress: string,
    amount: bigint
  ): Promise<ethers.ContractTransactionReceipt> {
    if (!this.wallet) {
      throw new CampaignCreationError('Wallet not loaded', 'WalletNotLoaded');
    }

    try {
      console.log('\n📝 Checking token approval...');
      
      const erc20Contract = new ethers.Contract(
        rewardTokenAddress,
        ERC20_ABI.abi,
        this.wallet
      );

      // Check current allowance
      const currentAllowance = await erc20Contract.allowance(
        this.wallet.address,
        this.config.smartRewardsAddress
      );

      console.log('  Current allowance:', ethers.formatEther(currentAllowance));
      console.log('  Required amount:', ethers.formatEther(amount));

      if (currentAllowance < amount) {
        console.log('  Insufficient allowance, requesting approval...');

        // Estimate gas for approval
        const gasEstimate = await erc20Contract.approve.estimateGas(
          this.config.smartRewardsAddress,
          amount
        );

        // Send approval transaction
        const txOptions: any = {
          gasLimit: gasEstimate * 2n // 2x buffer for safety
        };

        // Use legacy transaction type for Sonic if specified
        if (this.config.useLegacyTx) {
          txOptions.type = 0;
        }

        const approvalTx = await erc20Contract.approve(
          this.config.smartRewardsAddress,
          amount,
          txOptions
        );

        console.log('  Approval tx sent:', approvalTx.hash);
        
        const receipt = await approvalTx.wait();
        console.log('✓ Approval confirmed in block:', receipt.blockNumber);
        return receipt;
      } else {
        console.log('✓ Sufficient allowance already exists');
        return null as any;
      }
    } catch (error) {
      throw new CampaignCreationError(
        `Token approval failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ApprovalError'
      );
    }
  }

  /**
   * Calculate campaign timing based on current blockchain time
   */
  async calculateCampaignTiming(
    startDelayInHours: number,
    durationInDays: number
  ): Promise<{ startTimestamp: number; endTimestamp: number }> {
    try {
      const currentBlock = await this.provider.getBlock('latest');
      if (!currentBlock) {
        throw new Error('Failed to fetch latest block');
      }

      const currentTimestamp = currentBlock.timestamp;
      const SECONDS_PER_HOUR = 3600;
      const SECONDS_PER_DAY = 86400;

      const startTimestamp = currentTimestamp + (startDelayInHours * SECONDS_PER_HOUR);
      const durationInSeconds = durationInDays * SECONDS_PER_DAY;
      const endTimestamp = startTimestamp + durationInSeconds;

      console.log('\n⏰ Campaign Timing:');
      console.log('  Current time:', new Date(currentTimestamp * 1000).toISOString());
      console.log('  Start time:', new Date(startTimestamp * 1000).toISOString());
      console.log('  End time:', new Date(endTimestamp * 1000).toISOString());
      console.log('  Duration:', durationInDays, 'days');

      return { startTimestamp, endTimestamp };
    } catch (error) {
      throw new CampaignCreationError(
        `Failed to calculate campaign timing: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'TimingCalculationError'
      );
    }
  }

  /**
   * Upload campaign metadata to IPFS
   * Note: This is a placeholder - implement with your IPFS client
   */
  async uploadToIPFS(metadata: CampaignMetadata): Promise<string> {
    console.log('  Campaign metadata:', JSON.stringify(metadata, null, 2));
    
    // TODO: Implement actual IPFS upload
    // For now, return the execution bundle hash from metadata
    return metadata.execution_bundle;
  }

  /**
   * Create a reward campaign on the blockchain
   */
  async createCampaign(
    campaignParams: {
      poolAddress: string;
      rewardTokenAddress: string;
      escrowAmount: string;
      durationInDays: number;
      startDelayInHours: number;
      metadata: CampaignMetadata;
    }
  ): Promise<CampaignCreationResult> {
    if (!this.wallet) {
      throw new CampaignCreationError('Wallet not loaded', 'WalletNotLoaded');
    }

    try {
      console.log('\n🚀 Starting Campaign Creation\n');
      console.log('='.repeat(60));

      // Step 1: Initialize SmartRewards contract
      console.log('\n1️⃣ Initializing SmartRewards contract...');
      const smartRewardsContract = new ethers.Contract(
        this.config.smartRewardsAddress,
        SMART_REWARDS_TIMESTAMP_ABI.abi,
        this.wallet
      );
      console.log('✓ Contract initialized at:', this.config.smartRewardsAddress);

      // Step 2: Calculate campaign timing
      const { startTimestamp, endTimestamp } = await this.calculateCampaignTiming(
        campaignParams.startDelayInHours,
        campaignParams.durationInDays
      );

      // Step 3: Prepare campaign metadata
      console.log('\n2️⃣ Preparing campaign metadata...');
      const fullMetadata: CampaignMetadata = {
        ...campaignParams.metadata,
        epochLength: endTimestamp - startTimestamp,
        rewarderType: 'timestamp_based',
        execution_parameters: campaignParams.metadata.execution_parameters || {}
      };

      const ipfsHash = await this.uploadToIPFS(fullMetadata);
      console.log('✓ Campaign metadata IPFS hash:', ipfsHash);

      // Step 4: Parse escrow amount
      const escrowAmount = ethers.parseEther(campaignParams.escrowAmount);

      const onChainParams = {
        owner: this.wallet.address,
        liquidityPool: campaignParams.poolAddress,
        rewardToken: campaignParams.rewardTokenAddress,
        escrowAmount: escrowAmount,
        startTimestamp: startTimestamp,
        endTimestamp: endTimestamp,
        campaignParamsIPFSHash: ipfsHash,
      };

      console.log('\n3️⃣ Campaign Parameters:');
      console.log('  Owner:', onChainParams.owner);
      console.log('  Liquidity Pool:', onChainParams.liquidityPool);
      console.log('  Reward Token:', onChainParams.rewardToken);
      console.log('  Escrow Amount:', ethers.formatEther(escrowAmount), 'tokens');

      // Step 5: Check minimum reward requirements
      console.log('\n4️⃣ Checking minimum reward requirements...');
      const minimumReward = await smartRewardsContract.minimumRewardTokenAmounts(
        onChainParams.rewardToken
      );
      console.log('  Minimum required:', ethers.formatEther(minimumReward), 'tokens');
      console.log('  Your escrow:', ethers.formatEther(escrowAmount), 'tokens');

      if (escrowAmount < minimumReward) {
        throw new CampaignCreationError(
          `Escrow amount ${ethers.formatEther(escrowAmount)} is less than minimum required ${ethers.formatEther(minimumReward)}`,
          'InsufficientEscrowAmount'
        );
      }
      console.log('✓ Escrow amount meets minimum requirements');

      // Step 6: Approve tokens
      await this.approveTokens(onChainParams.rewardToken, escrowAmount);

      // Step 7: Create the campaign
      console.log('\n5️⃣ Creating reward campaign...');

      // Estimate gas
      const gasEstimate = await smartRewardsContract.createRewardCampaign.estimateGas(
        onChainParams
      );
      console.log('  Gas estimate:', gasEstimate.toString());

      // Send transaction
      const txOptions: any = {
        gasLimit: gasEstimate * 2n // 2x buffer for safety
      };

      if (this.config.useLegacyTx) {
        txOptions.type = 0; // Legacy transaction type for Sonic
      }

      const tx = await smartRewardsContract.createRewardCampaign(
        onChainParams,
        txOptions
      );

      console.log('  Transaction sent:', tx.hash);
      console.log('  Waiting for confirmation...');

      const receipt = await tx.wait();

      console.log('\n✓ Campaign created successfully!');
      console.log('  Transaction hash:', receipt.transactionHash);
      console.log('  Block number:', receipt.blockNumber);
      console.log('  Gas used:', receipt.gasUsed.toString());

      console.log('\n' + '='.repeat(60));
      console.log('✅ Campaign creation completed successfully!\n');

      return {
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        campaignId: this.extractCampaignId(receipt, smartRewardsContract),
        startTimestamp,
        endTimestamp,
        escrowAmount: escrowAmount.toString(),
        ipfsHash
      };

    } catch (error) {
      if (error instanceof CampaignCreationError) {
        throw error;
      }

      throw new CampaignCreationError(
        `Campaign creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CampaignCreationFailed',
        error
      );
    }
  }

  /**
   * Extract campaign ID from transaction receipt
   */
  private extractCampaignId(
    receipt: ethers.ContractTransactionReceipt,
    contract: ethers.Contract
  ): string | undefined {
    try {
      for (const log of receipt.logs) {
        try {
          const parsedLog = contract.interface.parseLog({
            topics: [...log.topics],
            data: log.data
          });

          if (parsedLog?.name === 'RewardCampaignCreated') {
            return parsedLog.args.campaignId?.toString();
          }
        } catch {
          continue;
        }
      }
    } catch (error) {
      console.warn('Failed to extract campaign ID from receipt');
    }
    return undefined;
  }

  /**
   * Get wallet address
   */
  getWalletAddress(): string {
    if (!this.wallet) {
      throw new CampaignCreationError('Wallet not loaded', 'WalletNotLoaded');
    }
    return this.wallet.address;
  }

  /**
   * Get provider
   */
  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }
}

/**
 * Convenience function to create a campaign with minimal configuration
 */
export async function createSonicCampaign(
  walletConfig: WalletConfig,
  campaignConfig: {
    poolAddress: string;
    rewardTokenAddress: string;
    escrowAmount: string;
    durationInDays: number;
    startDelayInHours: number;
    metadata: CampaignMetadata;
  },
  options?: {
    rpcUrl?: string;
    smartRewardsAddress?: string;
  }
): Promise<CampaignCreationResult> {
  const config: CampaignCreationConfig = {
    chainId: 146, // Sonic
    rpcUrl: options?.rpcUrl || 'https://rpc.soniclabs.com',
    smartRewardsAddress: options?.smartRewardsAddress || '0x3966b5B8AD4BEf3Be7d391d36d7202B3CB0D0C3f',
    useLegacyTx: true // Sonic requires legacy transactions
  };

  const creator = new CampaignCreator(config);
  await creator.loadWallet(walletConfig);
  return await creator.createCampaign(campaignConfig);
}

