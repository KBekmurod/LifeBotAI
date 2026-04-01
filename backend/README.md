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
| `TELEGRAM_BOT_TOKEN`| Telegram bot token from @BotFather     | *(unset)*                            |
| `WEBHOOK_URL`       | Public HTTPS URL for Telegram webhook  | *(unset)*                            |
| `OPENAI_API_KEY`    | OpenAI API key (leave blank for mock AI)| *(unset)*                           |

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
│   │   ├── auth.js        # POST /auth/telegram, GET /auth/me
│   │   ├── chat.js        # Chat session CRUD + AI messaging
│   │   └── bot.js         # POST /bot/webhook (Telegram updates)
│   ├── services/
│   │   └── aiService.js   # AI response generation (mock + OpenAI)
│   ├── bot/
│   │   └── index.js       # Telegraf bot setup, command handlers
│   └── utils/
│       ├── jwt.js         # JWT sign / verify helpers
│       └── logger.js      # Simple console logger
├── tests/
│   ├── setup.test.js      # Health route test
│   ├── models.test.js     # Mongoose schema / validation tests
│   ├── auth.test.js       # JWT utilities, auth routes, middleware tests
│   ├── chat.test.js       # Chat session routes + AI messaging tests
│   └── bot.test.js        # AI service unit tests + bot webhook tests
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

---

## Telegram Bot & AI Chat (Step 1.4)

### Telegram Bot

The bot is built with [Telegraf](https://telegraf.js.org/) and runs in **webhook mode** in production.

Set `TELEGRAM_BOT_TOKEN` and `WEBHOOK_URL` in `.env`, then the server will automatically register the webhook on startup.

**Supported commands:**

| Command    | Description                             |
|------------|-----------------------------------------|
| `/start`   | Greet the user and explain the bot      |
| `/help`    | List all available commands             |
| `/newchat` | Instructions for starting a chat session via REST API |
| `/endchat` | Instructions for closing a chat session via REST API  |

Telegram delivers updates to `POST /bot/webhook`.

### AI Chat API

All chat routes require a valid `Authorization: Bearer <JWT>` header.

| Method  | Path                            | Description                              |
|---------|---------------------------------|------------------------------------------|
| `POST`  | `/chat/sessions`                | Create a new chat session                |
| `GET`   | `/chat/sessions`                | List the user's chat sessions            |
| `GET`   | `/chat/sessions/:id`            | Get a session with its full message history |
| `POST`  | `/chat/sessions/:id/messages`   | Send a message and receive an AI reply   |
| `PATCH` | `/chat/sessions/:id/close`      | Close (end) a chat session               |

#### POST /chat/sessions

**Request body (all fields optional):**

```json
{
  "isLegacyMode": false,
  "heirTelegramId": null
}
```

**Success response (201):**

```json
{ "session": { "_id": "...", "status": "open", "messages": [], ... } }
```

#### POST /chat/sessions/:id/messages

**Request body:**

```json
{ "content": "Salom! Mening bolaligimdagi xotiralarim haqida gaplashamiz." }
```

**Success response (200):**

```json
{
  "userMessage":      { "role": "user",      "content": "...", "sentAt": "..." },
  "assistantMessage": { "role": "assistant",  "content": "...", "sentAt": "..." }
}
```

#### AI Provider

When `OPENAI_API_KEY` is set the service calls the OpenAI Chat Completions API
(`gpt-4o-mini`).  Otherwise a built-in rule-based mock is used — no API key
required for development and testing.

