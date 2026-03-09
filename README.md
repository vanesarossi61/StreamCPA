# StreamCPA — CPA Marketplace for Streamers

A full-stack marketplace where brands publish CPA campaigns and streamers find, promote, and earn from real conversions. Built with Next.js 14, TypeScript, tRPC, Prisma, and PostgreSQL.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router, RSC, Server Actions) |
| Language | TypeScript (end-to-end type safety) |
| API | tRPC v11 + React Query |
| Database | PostgreSQL + Prisma ORM |
| Auth | NextAuth.js (Twitch OAuth + credentials) |
| UI | Tailwind CSS + shadcn/ui + Radix UI + Recharts |
| Payments | Stripe (deposits) + PayPal/Wise (payouts) |
| Email | Resend (transactional) |
| Cache | Redis (rate limiting + sessions) |
| Deploy | Docker + Vercel |

## Features

### For Streamers
- Twitch OAuth with automatic profile import
- Streamer Score algorithm (followers, avg viewers, account age)
- Marketplace with filters (category, country, payout, conversion type)
- One-click campaign applications
- Unique affiliate link generation (nanoid, 8-char slugs)
- Real-time dashboard: clicks, conversions, earnings, EPC
- Withdrawal via PayPal or Wise ($50 minimum)

### For Brands
- Company registration with admin verification
- Multi-step campaign wizard (info, CPA config, targeting, budget)
- Streamer application management
- Escrow deposits via Stripe Checkout
- Performance dashboard: spend, conversions, CVR, ROAS
- Budget control with low-budget alerts

### Tracking Engine
- Edge-optimized click redirect (`/r/[slug]`)
- Click recording: hashed IP, geo, device, user agent, referer
- Server-to-server postback (`/api/postback?cid=xxx&payout=xxx`)
- Anti-fraud scoring: IP velocity, geo mismatch, duplicate detection
- Fraud queue with manual review

### Admin Backoffice
- Platform metrics dashboard with charts
- Brand verification queue
- Campaign moderation (approve/reject/pause)
- Fraud detection center with resolve workflow
- Payout processing queue
- User management with ban/unban

### Security
- Role-based middleware (STREAMER/BRAND/ADMIN)
- CSRF protection (double-submit cookie pattern)
- Rate limiting (IP + user-based via Redis)
- Security headers (CSP, HSTS, X-Frame-Options)
- Input validation (Zod schemas on every endpoint)

## Project Structure

```
streamcpa/
├── prisma/
│   ├── schema.prisma          # Database schema (25+ models)
│   └── seed.ts                # Seed data
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── (auth)/            # Login, Register
│   │   ├── (dashboard)/
│   │   │   ├── admin/         # Admin pages (dashboard, users, campaigns, fraud)
│   │   │   ├── brand/         # Brand pages (dashboard, campaigns, billing)
│   │   │   ├── streamer/      # Streamer pages (dashboard, earnings, links, payouts)
│   │   │   └── settings/      # Shared settings
│   │   ├── (marketing)/       # Landing, marketplace
│   │   ├── (legal)/           # Terms, privacy
│   │   ├── onboarding/        # Streamer + brand onboarding
│   │   ├── r/[slug]/          # Click tracking redirect
│   │   └── api/               # API routes (postback, stripe, health, cron)
│   ├── components/
│   │   ├── ui/                # shadcn/ui primitives
│   │   └── dashboard/         # Business components
│   │       ├── stats-cards.tsx
│   │       ├── charts.tsx
│   │       ├── data-table.tsx
│   │       ├── campaign-card.tsx
│   │       ├── campaign-wizard.tsx
│   │       ├── link-builder.tsx
│   │       ├── payout-form.tsx
│   │       ├── notification-bell.tsx
│   │       ├── file-upload.tsx
│   │       └── fraud-case.tsx
│   ├── server/
│   │   ├── trpc.ts            # tRPC init + auth context
│   │   ├── root.ts            # Root router
│   │   └── routers/
│   │       ├── auth.ts        # Auth procedures
│   │       ├── streamer.ts    # Streamer API
│   │       ├── brand.ts       # Brand API
│   │       ├── campaign.ts    # Campaign CRUD
│   │       ├── tracking.ts    # Click + conversion tracking
│   │       ├── payout.ts      # Payout processing
│   │       └── admin.ts       # Admin API (20 endpoints)
│   ├── lib/
│   │   ├── trpc.ts            # Client-side tRPC
│   │   ├── auth.ts            # NextAuth config
│   │   ├── prisma.ts          # Prisma client singleton
│   │   ├── redis.ts           # Redis client + rate limiters
│   │   ├── stripe.ts          # Stripe helpers
│   │   ├── rate-limit.ts      # Rate limit middleware
│   │   ├── csrf.ts            # CSRF protection
│   │   ├── email.ts           # Email templates
│   │   ├── fraud.ts           # Fraud scoring engine
│   │   ├── env.ts             # Env validation (Zod)
│   │   └── utils.ts           # Shared utilities
│   └── middleware.ts          # Auth + RBAC + CSRF + security headers
├── __tests__/                 # Vitest test suite
├── docker-compose.yml         # Postgres + Redis + App
├── Dockerfile                 # Multi-stage production build
├── next.config.ts             # CSP, images, redirects, standalone output
├── tailwind.config.ts
├── tsconfig.json
└── env.example                # All environment variables
```

## Quick Start

### Prerequisites
- Node.js 20+
- pnpm 8+
- Docker (for local Postgres + Redis)

### 1. Clone and install

```bash
git clone https://github.com/vanesarossi61/StreamCPA.git
cd StreamCPA
pnpm install
```

### 2. Start infrastructure

```bash
# Start Postgres + Redis
docker compose up db redis -d

# Optional: Prisma Studio
docker compose --profile dev up studio -d
```

### 3. Configure environment

```bash
cp env.example .env.local

# Generate NextAuth secret
openssl rand -base64 32
# Paste into NEXTAUTH_SECRET in .env.local

# Fill in Twitch, Stripe, and Resend credentials
```

### 4. Setup database

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed demo data (optional)
npx prisma db seed
```

### 5. Run development server

```bash
pnpm dev
# Open http://localhost:3000
```

### 6. Stripe webhooks (local)

```bash
# In a separate terminal:
stripe listen --forward-to localhost:3000/api/stripe/webhook
# Copy the webhook secret to STRIPE_WEBHOOK_SECRET
```

## Docker Production Deploy

```bash
# Build and start everything
docker compose up -d

# Run migrations
docker compose --profile migrate run migrate

# View logs
docker compose logs -f app
```

## Vercel Deploy

1. Push to GitHub
2. Import project in Vercel
3. Set all env variables from `env.example`
4. Use Supabase for Postgres (set `DATABASE_URL`)
5. Use Upstash for Redis (set `UPSTASH_REDIS_*`)
6. Deploy

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/r/[slug]` | GET | Click tracking redirect |
| `/api/postback` | GET/POST | Conversion postback (server-to-server) |
| `/api/stripe/webhook` | POST | Stripe event handler |
| `/api/health` | GET | Health check |
| `/api/trpc/*` | POST | tRPC API (all business logic) |

## tRPC Routers

| Router | Endpoints | Description |
|--------|-----------|-------------|
| `auth` | 5 | Register, login, profile, password |
| `streamer` | 12 | Dashboard, earnings, links, payouts |
| `brand` | 10 | Dashboard, campaigns, billing, applications |
| `campaign` | 8 | CRUD, marketplace, applications |
| `tracking` | 4 | Clicks, conversions, stats |
| `payout` | 6 | Config, withdraw, history |
| `admin` | 20 | Users, campaigns, fraud, payouts, stats |

## Testing

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage
pnpm test:coverage
```

## Key Design Decisions

- **tRPC over REST**: End-to-end type safety, no API client codegen, React Query built-in
- **Double-submit CSRF**: Stateless, no session store needed, works with tRPC batch requests
- **Sliding window rate limiting**: More accurate than fixed windows, prevents burst abuse
- **Fraud scoring**: Multi-signal approach (IP velocity, geo, timing, device fingerprint)
- **Standalone Docker**: `next build` with `output: standalone` for minimal container size
- **Escrow model**: Brand deposits locked via Stripe, released to streamers on valid conversions

## License

Private — All rights reserved.
