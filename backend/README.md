# LifeBotAI — Backend

Node.js/Express/MongoDB backend for the Life Archive AI platform.

## Quick Start

```bash
cd backend
cp .env.example .env      # edit MONGODB_URI as needed
npm install
npm run dev               # starts server with nodemon
```

## Health Check

```
GET /health  →  200 OK  { "ok": true }
```

## Environment Variables

| Variable      | Description                        | Default                              |
|---------------|------------------------------------|--------------------------------------|
| `PORT`        | Port the server listens on         | `3000`                               |
| `MONGODB_URI` | MongoDB connection string          | `mongodb://localhost:27017/lifebotai`|
| `NODE_ENV`    | Runtime environment                | `development`                        |

## Project Structure

```
backend/
├── src/
│   ├── server.js          # Express app entry point
│   ├── config/
│   │   ├── database.js    # MongoDB connection
│   │   └── env.js         # Environment variable loader
│   ├── models/
│   │   ├── index.js       # Unified model exports
│   │   ├── User.js        # Telegram user & subscription plan
│   │   ├── Memory.js      # Voice/text/photo/video/document memories
│   │   ├── LegacyConfig.js# Heirs, future letters, death signal, AI personality
│   │   ├── Subscription.js# Stripe subscription history
│   │   └── AiChat.js      # AI chat sessions & message history
│   └── utils/
│       └── logger.js      # Simple console logger
├── tests/
│   ├── setup.test.js      # Health route test
│   └── models.test.js     # Schema validation tests (45 tests)
├── .env.example
├── .gitignore
└── package.json
```

## Scripts

| Command         | Description                     |
|-----------------|---------------------------------|
| `npm start`     | Start server (production)       |
| `npm run dev`   | Start server with auto-reload   |
| `npm test`      | Run tests                       |
