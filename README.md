# Smart Rewards Campaign Operations

A comprehensive TypeScript library for managing Smart Rewards campaign operations, including campaign data fetching, rewards calculation, and on-chain claim execution.

## Features

- 🎯 **Campaign Management**: Fetch and manage campaigns with pagination support
- 💰 **Rewards Calculation**: Calculate claimable rewards with precision
- 🔗 **On-chain Claims**: Execute claims directly on blockchain
- 🏷️ **Token Enrichment**: Fetch token metadata automatically
- ⚡ **GraphQL Client**: Efficient campaign data querying
- 🛡️ **Error Handling**: Comprehensive error handling and validation
- 📊 **CLI Interface**: Command-line interface for operations

## Installation

```bash
# Install dependencies
yarn install

# Build the project
yarn build

# Start the application
yarn start
```

## Usage

### As a Library

```typescript
import { SmartRewardsClient, fetchCampaignsByChainId } from 'smart-rewards-campaign-ops';

// Simple campaign fetching
const campaigns = await fetchCampaignsByChainId(1); // Ethereum mainnet
console.log(`Found ${campaigns.totalCount} campaigns`);

// Advanced usage with Smart Rewards client
const client = new SmartRewardsClient();
const result = await client.processCampaign(userAddress, chainId, campaignId);

// Check claimable rewards
const canClaim = await client.canUserClaim(userAddress, chainId, campaignId);
if (canClaim.canClaim) {
  console.log(`Can claim ${canClaim.remaining} ${canClaim.rewardTokenSymbol}`);
}
```

### CLI Usage

```bash
# Run CLI commands
yarn cli

# Development mode
yarn dev
```

## Project Structure

```
src/
├── index.ts                    # Main entry point and exports
├── types/                      # Type definitions
│   └── index.ts               # All TypeScript type definitions
├── clients/                    # API and external service clients
│   ├── graphql-client.ts      # GraphQL client for campaign queries
│   ├── smart-rewards-client.ts # Smart Rewards GraphQL operations
│   └── token-enrichment.ts    # Token metadata fetching
├── core/                       # Core business logic
│   ├── smart-rewards.ts       # Main Smart Rewards orchestration
│   ├── calculations.ts        # Reward calculation utilities
│   └── pagination.ts          # Pagination utilities
├── blockchain/                 # Blockchain-related functionality
│   └── onchain-claim.ts       # On-chain claim execution
├── utils/                      # Utility functions
│   └── error-handler.ts       # Error handling and validation
└── cli/                        # Command-line interface
    └── smart-rewards-cli.ts   # CLI implementation
```

## Development

```bash
# Development with watch mode
yarn build:watch

# Type checking
yarn type-check

# Linting
yarn lint
yarn lint:fix

# Testing
yarn test
yarn test:watch
```

## Configuration

The project uses TypeScript with strict mode enabled and includes:

- **ESLint**: Code linting with TypeScript rules
- **Jest**: Testing framework with TypeScript support
- **Prettier**: Code formatting (via ESLint)
- **Build**: TypeScript compilation with declarations

## API Documentation

### SmartRewardsClient

Main client for Smart Rewards operations:

- `processCampaign(user, chainId, campaignId)`: Complete campaign processing
- `getClaimProofs(user, chainId, campaignId)`: Get claim proofs
- `calculateRewards(user, chainId, campaignId)`: Calculate rewards
- `executeClaim(chainId, proofs, decimals)`: Execute on-chain claim

### CampaignClient

Campaign data fetching:

- `fetchCampaignsByChainId(chainId, options)`: Fetch all campaigns
- `fetchCampaignsPage(chainId, cursor, pageSize)`: Paginated fetching
- `processCampaignsInChunks(chainId, processor)`: Process in chunks

### Utility Classes

- `RewardCalculator`: Reward calculations and unit conversions
- `TokenEnrichmentClient`: Token metadata fetching
- `PaginationManager`: Pagination handling
- `ErrorHandler`: Error handling and validation

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For issues and questions, please create an issue in the repository.
