#!/usr/bin/env bash
#
# eve Chat Template — one-shot local setup.
#
# Installs dependencies, creates .env.local from .env.example, generates the
# secrets that can be generated, and runs database migrations when DATABASE_URL
# is set. It talks to no hosting provider.
#
# Requires: node, pnpm, openssl. Run from the repo root:
#   ./scripts/setup.sh
#
set -euo pipefail

step() { printf '\n\033[1;36m==>\033[0m %s\n' "$1"; }
warn() { printf '\033[1;33m !\033[0m %s\n' "$1"; }
bold() { printf '\033[1m%s\033[0m\n' "$1"; }

# --- 0. Prerequisites -------------------------------------------------------
for cmd in node pnpm openssl; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "Missing required command: $cmd"; exit 1; }
done

NODE_MAJOR=$(node -e 'console.log(process.versions.node.split(".")[0])')
if [ "$NODE_MAJOR" -lt 24 ]; then
  echo "eve requires Node.js 24 or newer. You are running $(node -v). Please upgrade Node.js and try again."
  exit 1
fi

# --- 1. Dependencies --------------------------------------------------------
step "Installing dependencies"
pnpm install

# --- 2. Environment file ----------------------------------------------------
step "Preparing .env.local"
if [ ! -f .env.local ]; then
  cp .env.example .env.local
  echo "  created .env.local from .env.example"
else
  echo "  .env.local already exists, leaving it alone"
fi

# set_if_empty KEY VALUE — fill a key that exists but has no value.
set_if_empty() {
  local key="$1" value="$2"
  if grep -qE "^${key}=.+" .env.local; then
    echo "  $key already set, skipping"
    return
  fi
  if grep -qE "^${key}=" .env.local; then
    node -e 'const fs=require("fs");const [f,k,v]=process.argv.slice(1);fs.writeFileSync(f,fs.readFileSync(f,"utf8").replace(new RegExp("^"+k+"=.*$","m"),()=>k+"="+v))' \
      .env.local "$key" "$value"
  else
    printf '%s=%s\n' "$key" "$value" >> .env.local
  fi
  echo "  set $key"
}

# --- 3. Generated secrets ---------------------------------------------------
step "Generating secrets"
set_if_empty EVE_CHAT_PASSWORD "$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)"
set_if_empty BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
set_if_empty BETTER_AUTH_URL "http://localhost:3000"

# --- 4. Database migrations -------------------------------------------------
step "Database"
set -a; . ./.env.local; set +a
if [ -n "${DATABASE_URL:-}" ]; then
  echo "  running migrations against DATABASE_URL"
  pnpm db:migrate
else
  echo "  DATABASE_URL is empty — the starter keeps chats in browser storage."
  echo "  Point DATABASE_URL at any Postgres and re-run to enable production mode."
fi

# --- 5. What is left --------------------------------------------------------
step "Remaining setup"
[ -z "${ANTHROPIC_API_KEY:-}" ] && warn "ANTHROPIC_API_KEY is required before the agent can answer."
[ -z "${REDIS_URL:-}" ] && echo "  REDIS_URL is optional; set it to any Redis to enable distributed rate limiting."
echo "  Production mode also needs NEXT_PUBLIC_VERCEL_APP_CLIENT_ID and VERCEL_APP_CLIENT_SECRET"
echo "  from a Vercel OAuth app — see docs/setup-and-deploy.md."

step "Setup complete"
bold "Start the app:  pnpm dev"
