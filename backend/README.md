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
│   ├── models/            # Mongoose models (future)
│   └── utils/
│       └── logger.js      # Simple console logger
├── tests/
│   └── setup.test.js      # Health route test
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
