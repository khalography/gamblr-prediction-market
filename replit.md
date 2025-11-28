# Gamblr - Prediction Markets on Arc Testnet

## Overview

Gamblr is a decentralized prediction market platform built on the Arc Network testnet. Users can connect their Web3 wallets, deposit USDC, and place bets on various crypto-related prediction markets. The application integrates with a smart contract deployed on Arc testnet that manages deposits, bets, market creation, and winnings settlement.

The platform features a modern React frontend with shadcn/ui components, ethers.js for blockchain interaction, and an Express backend configured for both development and production environments.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React 18 with TypeScript and Vite as the build tool

**UI Component Library**: shadcn/ui (Radix UI primitives) with Tailwind CSS v4 for styling
- Component system follows the "new-york" style variant
- Custom theming with CSS variables for colors and spacing
- Responsive design with mobile-first approach

**State Management**:
- React Context API for Web3 wallet connection state
- TanStack Query (React Query) for server state management and caching
- Local component state with React hooks

**Routing**: Wouter (lightweight client-side routing)
- Main routes: Home (`/`), Admin (`/admin`), Portfolio (`/portfolio`)
- Not Found page for unmatched routes

**Web3 Integration**:
- ethers.js v6 for blockchain interaction
- Custom Web3Provider context wrapping the entire application
- Manages wallet connection, signer, contract instances, and balance tracking
- Supports Arc testnet with configurable RPC endpoints

### Backend Architecture

**Framework**: Express.js with TypeScript

**Development vs Production**:
- Development mode: Vite dev server with HMR middleware integrated into Express
- Production mode: Serves pre-built static assets from `/dist/public`
- Separate entry points (`index-dev.ts` and `index-prod.ts`) for each environment

**Storage Layer**:
- In-memory storage implementation (`MemStorage` class)
- Interface-based design allows for future database integration
- Currently configured for PostgreSQL with Drizzle ORM (schema defined but not actively used)

**API Design**:
- RESTful API routes prefixed with `/api`
- Storage interface provides CRUD operations for users and future entities
- Request/response logging middleware for debugging

### Smart Contract Integration

**Contract Address**: `0x18768Cd75D86E77CddE4B7DD3b222cCB604FDD5c`

**Core Functions**:
- `deposit(amount)`: Deposit USDC into internal ledger
- `withdraw(amount)`: Withdraw USDC from internal ledger
- `createMarket(question, duration)`: Admin-only market creation
- `placeBet(marketId, isYes, stakeAmount)`: Place bets on markets
- `resolveMarket(marketId, outcome)`: Admin-only market resolution
- `claimWinnings(marketId)`: Claim winnings from resolved markets

**USDC Token**: Arc testnet USDC at `0x3600000000000000000000000000000000000000`

**Internal Ledger System**: The contract maintains user balances internally rather than holding USDC directly, requiring approval + deposit flow

### Data Models

**User Schema** (Drizzle ORM):
```typescript
{
  id: UUID (primary key)
  username: string (unique)
  password: string
}
```

**Market Interface** (Frontend):
```typescript
{
  id: number
  question: string
  totalYes: string (USDC amount)
  totalNo: string (USDC amount)
  endTime: unix timestamp
  resolved: boolean
  outcome: 0 | 1 | 2 | 3 (pending | yes | no | void)
  oracle?: string (data source for settlement)
  isOnChain?: boolean (whether market exists on contract)
}
```

**Transaction Types** (Portfolio):
- deposit, withdraw, bet, claim
- Tracked with amounts, fees, timestamps, and transaction hashes

### Page Architecture

**Home Page**:
- Displays active prediction markets (mix of on-chain and preview markets)
- Markets are fetched from smart contract and merged with mock data
- Each market shows current odds, pool size, and time remaining
- Users can place bets through modal interface

**Admin Page**:
- Protected route for contract owner only
- Create new markets with custom questions and end dates
- Preview list of suggested crypto prediction markets
- Batch market creation functionality

**Portfolio Page**:
- Displays user's betting positions across all markets
- Transaction history with deposit/withdrawal/bet/claim events
- Statistics: total deposited, withdrawn, bet, won, lost
- Shows claimable winnings from resolved markets

### Design Patterns

**Component Composition**: Heavy use of compound components pattern (Card + CardHeader + CardContent)

**Dependency Injection**: Storage interface allows swapping implementations without changing business logic

**Context Providers**: Web3Provider encapsulates all blockchain interaction logic and provides it to child components

**Custom Hooks**: `useWeb3()`, `useToast()`, `useIsMobile()` for reusable stateful logic

**Error Boundaries**: Toast notifications for user-facing errors throughout the application

## External Dependencies

### Blockchain Infrastructure

**Arc Network Testnet**:
- Primary RPC: `https://rpc.testnet.arc.network`
- Alternative RPCs: Blockdaemon, DRPC, Quicknode
- Chain ID: Arc testnet chain ID (automatically detected)

**Smart Contract**: Custom Gamblr contract with internal USDC ledger system

**USDC Token Contract**: Arc testnet USDC for deposits/withdrawals

### Third-Party Services

**Replit Platform**:
- GitHub deployment integration (`deploy-to-github.ts`, `push-to-github.ts`)
- Octokit for GitHub API interactions
- Replit connectors for OAuth and secrets management
- Custom Vite plugins for Replit-specific features (cartographer, dev banner, runtime error overlay)

**Meta Image Plugin**: Custom Vite plugin for OpenGraph/Twitter card meta tags

### UI Libraries

**Radix UI**: Headless component primitives (Dialog, Dropdown, Popover, Toast, etc.)

**Tailwind CSS v4**: Utility-first styling with custom theme configuration

**Lucide Icons**: Icon library for UI elements

**date-fns**: Date formatting and manipulation

### Development Tools

**TypeScript**: Strict type checking across frontend and backend

**Drizzle Kit**: Database migrations and schema management (configured for PostgreSQL)

**Vite**: Fast build tool with HMR and optimized production builds

**ESBuild**: Backend bundling for production deployment

### Database (Configured but Inactive)

**Neon Database**: PostgreSQL serverless database (@neondatabase/serverless)
- Connection string expected in `DATABASE_URL` environment variable
- Drizzle ORM configured with migrations directory
- Schema defined but application currently uses in-memory storage

### Potential Oracle Integrations

Markets reference various oracle data sources for settlement:
- Chainlink price feeds (BTC/USD, ETH/USD, XRP/USD)
- Pyth Network (SOL/USD)
- CoinGecko API (market cap, stablecoin data)
- DefiLlama (TVL data)
- On-chain metrics (Etherscan, Blockchain.com)

Note: Oracle integration for automated settlement is not yet implemented; markets are currently resolved manually by contract owner.