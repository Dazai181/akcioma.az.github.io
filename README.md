# Aksioma Stationery — E-Commerce Platform

## Quick start (Phase 1)

### Prerequisites
- Node.js 20+
- pnpm (`npm install -g pnpm`)
- Docker Desktop

### 1. Install dependencies
```bash
pnpm install
```

### 2. Environment
```bash
cp .env.example apps/api/.env
# Edit apps/api/.env — update secrets as needed
```

### 3. Start database + Redis
```bash
docker compose up -d
# Wait ~10s for containers to be healthy
```

### 4. Run database migrations
```bash
cd apps/api
npx prisma migrate dev --name init --schema src/prisma/schema.prisma
npx prisma generate --schema src/prisma/schema.prisma
cd ../..
```

### 5. Start dev servers
```bash
pnpm dev
# API  → http://localhost:3001/api/v1
# Web  → http://localhost:3000
```

### 6. Test auth flow
```bash
# Register (OTP logged to terminal in dev mode)
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Ali","lastName":"Yılmaz","mobile":"+905551234567"}'

# Verify OTP (check terminal for the 6-digit code)
curl -X POST http://localhost:3001/api/v1/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"mobile":"+905551234567","otp":"123456"}'
```

## Project structure
```
aksioma/
├── apps/
│   ├── api/          NestJS backend (Port 3001)
│   └── web/          Next.js storefront + admin (Port 3000)
├── packages/
│   └── shared/       Shared TypeScript types
├── docker-compose.yml
└── .env.example
```
