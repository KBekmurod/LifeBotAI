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

| Variable        | Description                        | Default                              |
|-----------------|------------------------------------|--------------------------------------|
| `PORT`          | Port the server listens on         | `3000`                               |
| `MONGODB_URI`   | MongoDB connection string          | `mongodb://localhost:27017/lifebotai`|
| `NODE_ENV`      | Runtime environment                | `development`                        |
| `JWT_SECRET`    | Secret key for signing JWT tokens  | `changeme_jwt_secret_for_dev`        |
| `JWT_EXPIRES_IN`| JWT token lifetime                 | `7d`                                 |

## Project Structure

```
backend/
├── src/
│   ├── server.js          # Express app entry point
│   ├── config/
│   │   ├── database.js    # MongoDB connection
│   │   └── env.js         # Environment variable loader
│   ├── middleware/
│   │   └── auth.js        # Bearer JWT authentication middleware
│   ├── models/
│   │   ├── index.js       # Unified model exports
│   │   ├── User.js        # User schema (telegramId unique index)
│   │   ├── Memory.js      # Memory schema (userId+createdAt, userId+memorizedAt indexes)
│   │   ├── LegacyConfig.js# Legacy config schema (userId unique index)
│   │   ├── Subscription.js# Subscription schema (userId+status, userId+createdAt indexes)
│   │   └── AiChat.js      # AI chat schema (userId+heirTelegramId, userId+createdAt indexes)
│   ├── routes/
│   │   └── auth.js        # POST /auth/telegram, GET /auth/me
│   └── utils/
│       ├── jwt.js         # JWT sign / verify helpers
│       └── logger.js      # Simple console logger
├── tests/
│   ├── setup.test.js      # Health route test
│   ├── models.test.js     # Mongoose schema / validation tests
│   └── auth.test.js       # JWT utilities, auth routes, middleware tests
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

## Authentication (Step 1.3)

### Endpoints

| Method | Path             | Auth required | Description                                         |
|--------|------------------|---------------|-----------------------------------------------------|
| `POST` | `/auth/telegram` | No            | Register or login via Telegram; returns a JWT token |
| `GET`  | `/auth/me`       | Yes           | Return the current authenticated user's profile     |

#### POST /auth/telegram

**Request body:**

```json
{
  "telegramId": "123456789",
  "firstName": "Alibek",
  "username": "alibekdev",
  "lastName": "Yusupov",
  "language": "uz"
}
```

`telegramId` and `firstName` are required. All other fields are optional.

**Success response (200):**

```json
{
  "token": "<JWT>",
  "user": { "_id": "...", "telegramId": "123456789", ... }
}
```

#### GET /auth/me

Requires `Authorization: Bearer <token>` header.

**Success response (200):**

```json
{
  "user": { "_id": "...", "telegramId": "123456789", ... }
}
```

### JWT Middleware

Import `src/middleware/auth.js` to protect any route:

```js
const authenticate = require('./middleware/auth');

router.get('/protected-resource', authenticate, (req, res) => {
  // req.user is the authenticated User document
  res.json({ user: req.user });
});
```

The middleware reads the `Authorization: Bearer <token>` header, verifies the JWT, and attaches the active `User` document to `req.user`. Returns `401` if the token is absent, invalid, expired, or belongs to an inactive user.

## Scripts

| Command              | Description                        |
|----------------------|------------------------------------|
| `npm start`          | Start server (production)          |
| `npm run dev`        | Start server with auto-reload      |
| `npm test`           | Run all tests (Jest)               |
| `npm run sanity-check` | Run schema/export sanity checks  |
