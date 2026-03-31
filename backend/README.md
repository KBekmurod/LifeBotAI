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
│   │   ├── User.js        # User schema (telegramId unique index)
│   │   ├── Memory.js      # Memory schema (userId+createdAt, userId+memorizedAt indexes)
│   │   ├── LegacyConfig.js# Legacy config schema (userId unique index)
│   │   ├── Subscription.js# Subscription schema (userId+status, userId+createdAt indexes)
│   │   └── AiChat.js      # AI chat schema (userId+heirTelegramId, userId+createdAt indexes)
│   └── utils/
│       └── logger.js      # Simple console logger
├── tests/
│   ├── setup.test.js      # Health route test
│   └── models.test.js     # Mongoose schema / validation tests
├── .env.example
├── .gitignore
└── package.json
```

## Mongoose Models (Step 1.2)

All models are exported from `src/models/index.js`:

```js
const { User, Memory, LegacyConfig, Subscription, AiChat } = require('./src/models');
```

| Model          | Key indexes                                          |
|----------------|------------------------------------------------------|
| `User`         | `telegramId` (unique)                                |
| `Memory`       | `userId+createdAt`, `userId+memorizedAt`, `userId+tags`, `userId+type` |
| `LegacyConfig` | `userId` (unique)                                    |
| `Subscription` | `userId+status`, `userId+createdAt`, `stripeSubscriptionId` |
| `AiChat`       | `userId+heirTelegramId`, `userId+createdAt`          |

## Scripts

| Command         | Description                     |
|-----------------|---------------------------------|
| `npm start`     | Start server (production)       |
| `npm run dev`   | Start server with auto-reload   |
| `npm test`      | Run tests                       |
