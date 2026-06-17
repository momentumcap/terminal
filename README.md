# Momentum Terminal

An MVP trader terminal for monitoring Base L2 tokens. It ranks tokens using public DexScreener and GeckoTerminal data, then surfaces momentum, liquidity health, buy/sell pressure, risk flags, and alerts.

## Public Beta Warning

Momentum Terminal is decision-support software, not financial advice. It can surface stale, partial, estimated, or provider-conflicted data. Users must independently verify contract address, liquidity, holder data, contract permissions, taxes, and sellability before trading.

The app includes a user-facing limitations page at `/limitations`. Keep this page visible in public builds. Unknown risk is not safety, and a credible creator or high score is never a guarantee.

## Stack

- Next.js + TypeScript
- Tailwind CSS
- Recharts
- Node API routes
- SQLite-backed local data layer with Postgres-friendly schema
- Base mainnet chain ID: `8453`

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Copy `.env.example` to `.env.local` if you want to override API base URLs or database location. By default, local observations are written to `data/momentum.sqlite`.

## Password-Protected Public Access

Set these values before deploying a public beta:

```bash
NEXT_PUBLIC_SITE_URL=https://momentumterminal.xyz
SITE_PASSWORD=replace-with-your-private-beta-password
AUTH_COOKIE_SECRET=replace-with-a-long-random-secret
CRON_SECRET=replace-with-a-long-random-cron-secret
```

When `SITE_PASSWORD` is set, every terminal, admin, Bankr, analysis, and API route is protected by middleware. Visitors land on `/access`, enter the password, and receive an HTTP-only access cookie. If `SITE_PASSWORD` is blank in local development, the gate is disabled so development remains easy. Production builds fail closed behind `/access` if the password is missing, so set this before launch.

`CRON_SECRET` protects scheduled indexer routes. Vercel Cron sends it as `Authorization: Bearer <CRON_SECRET>` when configured, and the cron routes fail closed in production if it is missing.

## Custom Domain Setup

Recommended public-beta hosting path: deploy the Next.js app to Vercel, then point Cloudflare DNS at Vercel.

1. Create a Vercel project from this repo.
2. Add the production environment variables from `.env.local`, including `NEXT_PUBLIC_SITE_URL`, `SITE_PASSWORD`, `AUTH_COOKIE_SECRET`, RPC/indexer keys, and API keys.
3. In Vercel, add both domains:
   - `momentumterminal.xyz`
   - `www.momentumterminal.xyz`
4. In Cloudflare DNS, add the records Vercel shows. Typical records are:
   - `A` record: `@` -> Vercel's apex IP
   - `CNAME` record: `www` -> Vercel's CNAME target
5. In Cloudflare SSL/TLS, use `Full` or `Full (strict)` once Vercel's certificate is active.
6. Keep the password gate enabled until the beta is ready for open access.

Cloudflare Pages can host static sites, but this terminal uses Next.js server API routes and Node-side provider adapters. Vercel or another Node-capable host is the cleaner MVP deployment target.

## API Routes

- `GET /api/tokens/trending`
- `GET /api/tokens/new`
- `GET /api/tokens/search?q=`
- `GET /api/tokens/:address`
- `GET /api/alerts`
- `GET /api/watchlist`
- `POST /api/watchlist`
- `GET /api/analysis/:address`
- `GET /api/analysis/:address/holders`
- `GET /api/analysis/:address/liquidity`
- `GET /api/analysis/:address/alerts`
- `GET /api/analysis/:address/wallets`
- `GET /api/analysis/:address/risk`
- `GET /api/onchain/:address`
- `GET /api/onchain/token/:address`
- `GET /api/onchain/token/:address/holders`
- `GET /api/onchain/token/:address/risk`
- `GET /api/onchain/token/:address/deployer`
- `GET /api/onchain/token/:address/events`
- `GET /api/onchain/wallet/:address`
- `GET /api/onchain/health`
- `GET /api/social/token/:address`
- `GET /api/admin/data/health`
- `GET /api/intelligence/holders/:address`
- `GET /api/indexer/holders/:address`
- `POST /api/indexer/holders/:address`

## Data Sources

The MVP uses public APIs first:

- DexScreener search/token endpoints
- GeckoTerminal Base trending/new pool endpoints

Fast-mode responses use live public data first. Live terminal routes do not silently substitute seeded mock rows, because plausible fake data is worse than an empty/degraded state. DexScreener-backed address/search/analysis paths refresh on a 15-second client/server cadence; GeckoTerminal discovery is held at a safer 30-second app cache because its public pool data is itself cached around one minute.

## Trust & Accuracy Philosophy

Momentum Terminal follows a simple rule: when we know, we show evidence; when we do not know, we say so.

- Every trusted metric should carry value, source, sources tried, confidence, last update time, stale status, missing fields, and warnings.
- Estimated values must be labeled as estimated and must not be presented as confirmed facts.
- Stale data cannot produce high-confidence labels.
- Provider disagreement is surfaced instead of hidden.
- Unknown is different from safe. Missing risk flags mean risk is unknown, not that a token is safe.
- The UI avoids absolute language such as guaranteed, rug confirmed, honeypot free, or safe token.

Stale thresholds:

- Market data: 90 seconds
- GeckoTerminal discovery: 2 minutes
- Holder data: 15 minutes
- Contract risk: 6 hours
- Deployer profile: 1 hour
- Alerts: 2 minutes

Source priority is contextual. Market metrics compare DexScreener and GeckoTerminal where available. Canonical reads and raw logs come from Base RPC/Alchemy. Holder totals, contract creation, source, and labels come from Blockscout and Etherscan/BaseScan when available. If sources materially disagree, confidence is downgraded and the disagreement is shown.

Scoring formula versions are exposed through trusted score metadata. Scores are deterministic decision-support signals, not guarantees. They list inputs used, missing inputs, boosts, penalties, confidence, and explanation.

Operational trust routes:

- `GET /api/health/providers`
- `GET /api/admin/alerts/performance`
- `GET /api/admin/data/health`
- `GET /api/intelligence/holders/:address`
- `POST /api/indexer/holders/:address`
- `POST /api/indexer/analysis/:address`
- `/admin/accuracy`
- `/limitations`

## Data Layer

The terminal now includes a durable local SQLite layer using Node's built-in SQLite runtime. It records observations rather than replacing providers:

- Token market snapshots from trending, new, search, and exact address lookup flows
- Trusted metric observations with source, confidence, stale/estimated flags, missing fields, and warnings
- Analysis snapshots with data quality, trusted metrics, trusted scores, and full analysis payload
- Onchain component snapshots for token metadata, holder distribution, contract risk, deployer profile, recent events, and owned Base RPC swap-window data
- Holder snapshots from Blockscout/Base RPC holder adapters
- ERC-20 transfer observations and wallet-token aggregates from the local holder/wallet indexer
- Holder indexer run history with block coverage, transfer count, wallet count, status, and warnings
- Bankr launches and their scoring/verdict payloads
- Provider health observations from `/api/health/providers`

The schema is defined in `lib/db/schema.ts` with both SQLite and Postgres-compatible DDL. Repository writes live in `lib/db/repository.ts` and intentionally fail soft: a database write should never crash the live terminal or hide provider data from the user.

The first holder/wallet indexer lives in `lib/indexer/holderWalletIndexer.ts`. It ingests recent ERC-20 `Transfer` logs through Base RPC, stores transfer observations, builds wallet-token aggregates, records indexer runs, and exposes a local holder intelligence summary. This is intentionally presented as observed local coverage, not complete historical truth, until a full backfill/indexer worker is added.

The analysis prewarmer lives in `lib/indexer/analysisPrewarm.ts` and can be triggered with `POST /api/indexer/analysis/:address`. It collects the exact-token market candidates, Base RPC swap windows, onchain metadata, holders, contract risk, deployer profile, recent events, and holder-wallet transfer memory, then stores component snapshots. The analysis engine reads live providers first, prewarmed component snapshots second, and last-known-good analysis snapshots third so a temporary provider miss does not erase previously observed data.

Production cron routes are defined in `vercel.json`:

- `/api/cron/freshness` runs every minute to refresh discovery feeds, tracked market snapshots, and event performance.
- `/api/cron/prewarm` runs every two minutes to prewarm high-priority Bankr, trending, new-pool, and tracked-token analysis data into SQLite/Neon.

Database env vars:

```bash
SQLITE_PATH=./data/momentum.sqlite
DATABASE_URL=
CRON_SECRET=
```

When `DATABASE_URL` is configured, Momentum Terminal mirrors critical analysis snapshots and onchain component snapshots to Neon/Postgres. SQLite remains the local/default store, while Neon provides durable production memory across Vercel deployments, cold starts, and temporary filesystem resets.

## Architecture

```text
app/
  api/                 Node API routes
  components/          Terminal UI modules
lib/
  analysis/            Base Token Analysis Engine modules
  alerts.ts            Deterministic alert rules
  data.ts              Aggregation and ranking
  dexscreener.ts       DexScreener client
  geckoterminal.ts     GeckoTerminal client
  normalize.ts         Provider-to-domain mappers
  scoring.ts           Deterministic scoring formulas
  storage.ts           Cache and watchlist shim
  types.ts             Domain contracts
  db/                  SQLite/Postgres-ready persistence layer
data/
  mockTokens.ts        Seed fallback dataset
```

The scoring formulas are documented directly in `lib/scoring.ts` so future onchain RPC, holder, concentration, and indexer modules can plug into the same `TokenSnapshot` and `TokenScores` contracts.

## Base Token Analysis Engine

The Analysis workspace accepts a Base token contract address and returns an institutional-style intelligence file:

- Executive summary and trend classification
- Rule-based tactical interpretation
- Momentum, liquidity, holder, smart-money, cluster, risk, deployer, manipulation, narrative, and tradeability analysis
- Live event feed with actionable alerts
- Transparent normalized 0-100 scoring models in `lib/analysis/scoring.ts`

Current public-data adapters use DexScreener and GeckoTerminal through the existing token normalization layer. Placeholder adapters are included for Alchemy, Base RPC, Covalent, Reservoir, Blockscout, GoPlus, and Honeypot APIs, so production indexer modules can replace the mock/proxy calculations without changing UI contracts.

The first owned-data lane is now included under `lib/onchain`: ERC-20 metadata, Uniswap V3 Base pool discovery, raw swap-log buy/sell windows, and a 24h transfer summary through Base RPC. Analysis prefers these Base RPC transaction windows when a supported pool is found, then falls back to provider-reported raw fields. Set `BASE_RPC_URL` or `ALCHEMY_BASE_RPC_URL` in `.env.local` for a stronger RPC; the public Base RPC works as a no-key fallback but may reject heavy log ranges.

## Base Onchain Adapter Layer

The production onchain layer lives in `lib/onchain` and exposes normalized functions instead of provider-specific calls:

- `getTokenOnchainProfile(address)`
- `getTokenTransfers(address, options)`
- `getTokenHolders(address, options)`
- `getWalletProfile(address)`
- `getLiquidityEvents(tokenAddress)`
- `getContractRiskProfile(address)`
- `getDeployerProfile(tokenAddress)`
- `getRecentTokenEvents(address)`
- `getTokenOwnershipDistribution(address)`
- `getTokenTradeabilityProfile(address)`

Provider priority is Base RPC first for canonical reads/logs, GoldRush first for holder count/distribution when configured, then Blockscout/BaseScan/Alchemy for indexed enrichment. Every response includes `dataQuality` with sources tried, confidence, missing fields, warnings, and partial-mode status. Holder reconstruction from RPC is explicitly approximate because it can only replay a bounded transfer window unless a full historical indexer is configured.

Useful env vars:

```bash
BASE_RPC_URL=https://mainnet.base.org
BASE_WS_URL=
ALCHEMY_BASE_RPC_URL=
ALCHEMY_API_KEY=
BASESCAN_API_KEY=
ETHERSCAN_API_KEY=
GOLDRUSH_API_KEY=
GOLDRUSH_BASE_URL=https://api.covalenthq.com
GOLDRUSH_HOLDERS_NO_SNAPSHOT=true
BLOCKSCOUT_BASE_API_URL=https://base.blockscout.com
INDEXER_PROVIDER=auto
```

Free mode works with the public Base RPC and Blockscout. Adding GoldRush improves holder count, holder distribution, and historical holder confidence. Adding Alchemy and Etherscan/BaseScan keys improves historical transfers, contract creation, token metadata, and risk confidence. Risk detection is heuristic unless verified source/ABI is available, and the UI marks those limitations rather than presenting guesses as facts.

## Social Momentum

The Analysis Engine includes a social momentum adapter layer under `lib/social`. It supports X recent search when an X bearer token is configured, Reddit public search as a best-effort secondary source, and a clearly labeled market-derived fallback when live social APIs are unavailable.

Optional env vars:

```bash
X_BEARER_TOKEN=
TWITTER_BEARER_TOKEN=
REDDIT_USER_AGENT=MomentumTerminal/0.1
FARCASTER_API_URL=
SOCIAL_PROVIDER_MODE=auto
```

Social metrics include 1h/6h/24h mentions, unique authors, engagement, sentiment, influencer activity, bot-risk proxy, top posts, confidence, missing fields, and warnings. This should be treated as a monitoring layer, not proof of project quality.
