# CLB DApp Backend

Backend ya CLB — Node.js + Fastify + Prisma (PostgreSQL) + BSC Blockchain

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** Fastify
- **Database:** PostgreSQL + Prisma ORM
- **Blockchain:** BSC (ethers.js)
- **Auth:** JWT (wallet signature verification)
- **Docs:** Swagger UI (`/docs`)

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Generate Prisma client
npx prisma generate

# 3. Create database & run migrations
npx prisma migrate dev --name init

# 4. Start dev server
npm run dev
```

Server itaanza kwenye `http://localhost:3000`
Swagger docs: `http://localhost:3000/docs`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/auth/nonce/:wallet` | Get nonce for signing |
| POST | `/api/auth/verify` | Verify signature → JWT |
| GET | `/api/auth/profile` | Get profile (JWT) |
| PUT | `/api/auth/profile` | Update profile (JWT) |
| GET | `/api/pools` | List pools |
| GET | `/api/pools/stats` | Pool statistics |
| GET | `/api/pools/:id` | Pool details |
| POST | `/api/pools` | Create pool (admin) |
| POST | `/api/pools/:id/deposit` | Record deposit |
| POST | `/api/referrals/generate` | Generate referral code |
| POST | `/api/referrals/apply` | Apply referral code |
| GET | `/api/referrals/my` | My referrals |
| GET | `/api/referrals/stats` | Referral stats |
| GET | `/api/prices` | Live crypto prices |
| GET | `/api/prices/:symbol` | Single coin price |
| GET | `/api/transactions` | Transaction history |
| GET | `/api/transactions/:id` | Transaction detail |

## Environment Variables

Copy `.env.example` to `.env` and fill in your values.

## Database

```bash
# Run migrations
npx prisma migrate dev

# Open Prisma Studio (GUI)
npx prisma studio
```
