#!/bin/bash
set -euo pipefail

# Only run in Claude Code on the web (remote) sessions
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Install dependencies (idempotent). The postinstall hook (api:load)
# downloads the iptv-org API data required by playlist:validate and tests.
npm install --no-audit --no-fund
