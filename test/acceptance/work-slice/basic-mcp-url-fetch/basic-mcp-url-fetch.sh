#!/usr/bin/env bash
# Runs the basic MCP URL fetch work slice: the entry point basic-mcp-url-fetch.ts with the pinned Node runtime of pnpm.
# See README.md in this folder.
# Usage: test/acceptance/work-slice/basic-mcp-url-fetch/basic-mcp-url-fetch.sh
# You can start the script from any directory. The script gives its arguments to the entry point.
# The script sets the settings of the slice to their defaults. A setting with a value before the call keeps that value.
# These values come before the values in .env.local, because the slice uses an exported value first.
# AXIOM_API_KEY is not in this file. Set it in the shell or in .env.local at the repository root.
# The slice reads that file itself.
set -euo pipefail

# CDPATH= keeps cd silent, so that root gets only the path.
root=$(CDPATH= cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd -P)
# The slice reads .env.local from the current directory. The last line names the entry point by its path from the root.
cd "$root"

export PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-http://127.0.0.1:8080}"
export AD_RULES_FILE="${AD_RULES_FILE:-$root/ad-rules.txt}"
# The recipe of docs/lightpanda-runtime.md installs the pinned release here.
export LIGHTPANDA_BIN="${LIGHTPANDA_BIN:-$root/.cache/lightpanda/1.0.0/lightpanda}"
# The settings reader uses this spelling: AXOIM.
export AXOIM_ENDPOINT_URL="${AXOIM_ENDPOINT_URL:-https://us-east-1.aws.edge.axiom.co}"
export AXIOM_SYSTEM_LOG_TEST_DATA_SET="${AXIOM_SYSTEM_LOG_TEST_DATA_SET:-system-log-test}"

# The slice checks the renderer and the Axiom key itself, with its own messages.
if [[ ! -f "$AD_RULES_FILE" ]]; then
  printf 'AD_RULES_FILE=%s is not a file. For no ad rules, make an empty file: touch "%s"\n' "$AD_RULES_FILE" "$AD_RULES_FILE" >&2
  exit 1
fi

printf '%s\n' \
  "PUBLIC_BASE_URL=$PUBLIC_BASE_URL" \
  "AD_RULES_FILE=$AD_RULES_FILE" \
  "LIGHTPANDA_BIN=$LIGHTPANDA_BIN" \
  "AXOIM_ENDPOINT_URL=$AXOIM_ENDPOINT_URL" \
  "AXIOM_SYSTEM_LOG_TEST_DATA_SET=$AXIOM_SYSTEM_LOG_TEST_DATA_SET" >&2
# pnpm exec gives the pinned Node runtime and passes a signal to its child. Thus a signal to this process stops the
# server, as Ctrl+C does. The package script would put a shell wrapper and the tsx CLI between them.
exec pnpm exec node --import tsx test/acceptance/work-slice/basic-mcp-url-fetch/basic-mcp-url-fetch.ts "$@"
