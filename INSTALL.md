# Zola Installation Guide

Zola is a free, open-source AI chat app with multi-model support. This is a
self-hosted, single-user fork: persistence is Postgres (via Drizzle ORM) and
auth is a username/password pair from environment variables — no Supabase,
no third-party auth provider.

![Zola screenshot](./public/cover_zola.webp)

## Prerequisites

- Node.js 18.x or later
- npm
- A Postgres database (local, Docker, or managed)
- API keys for supported AI models (OpenAI, Anthropic, OpenRouter, etc.) OR
  Ollama for local models

## Environment Setup

Copy `.env.example` to `.env.local` and fill in the required values:

```bash
# Database (required)
DATABASE_URL=postgres://user:password@localhost:5432/zola

# Auth (required)
AUTH_USERNAME=admin
AUTH_PASSWORD=change_me
AUTH_SECRET=your_32_character_random_string

# Encryption key for BYOK provider keys stored at rest (32 bytes, base64)
ENCRYPTION_KEY=your_base64_32_byte_key

# CSRF protection (required; also used to derive AUTH_SECRET if unset)
CSRF_SECRET=your_32_character_random_string

# AI model API keys (add whichever providers you use)
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
OPENROUTER_API_KEY=your_openrouter_api_key
MISTRAL_API_KEY=your_mistral_api_key
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key
XAI_API_KEY=your_xai_api_key
PERPLEXITY_API_KEY=your_perplexity_api_key

# Ollama (for local AI models)
OLLAMA_BASE_URL=http://localhost:11434
```

Generate `AUTH_SECRET`, `CSRF_SECRET`, and `ENCRYPTION_KEY` with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Database Setup

Point `DATABASE_URL` at a Postgres instance, then push the schema:

```bash
npm install
npm run db:push       # dev: sync schema directly to the database
# or, for versioned migrations:
npm run db:generate   # writes SQL under drizzle/
npm run db:migrate    # applies pending migrations
```

The single application user is created automatically on first login — there
is no signup flow.

## Running Locally

```bash
npm install
npm run dev
```

Visit `http://localhost:3000/auth` and sign in with `AUTH_USERNAME` /
`AUTH_PASSWORD`.

## Docker Deployment

The `Dockerfile` is a multi-stage build producing a Next.js `standalone`
output, with a healthcheck on `/api/health`.

```bash
docker build -t zola .
docker run \
  --env-file .env \
  zola
```

For a VM deployment behind a reverse proxy (Caddy, nginx, etc.), use the
provided compose snippet, which runs Zola on an internal network with no
published port:

```bash
docker compose -f deploy/compose.zola.yml up -d
```

## Configuration Options

- `lib/config.ts`: AI models, daily message limits, system prompt, etc.
- `lib/db/schema.ts`: database schema (Drizzle)
- `.env.local`: environment variables and API keys

## Troubleshooting

1. **Can't sign in** — verify `AUTH_USERNAME`/`AUTH_PASSWORD` match what's set
   in the environment; the app compares them in constant time.
2. **Database connection fails** — check `DATABASE_URL` and that the
   database is reachable and the schema has been pushed/migrated.
3. **AI models not responding** — verify the relevant provider API key, or
   add your own key in Settings → API Keys (BYOK).
4. **Docker container exits immediately** — check `docker logs <container>`
   and confirm all required environment variables are set.

## License

Apache License 2.0
