#!/usr/bin/env bash
# Runs the auth WorkOS MCP URL fetch work slice: the entry point auth-workos-mcp-url-fetch.ts with the pinned Node
# runtime of pnpm. See README.md in this folder.
# Usage, through the staging launcher, which sets WORKOS_API_KEY, WORKOS_CLIENT_ID, and WORKOS_AUTHKIT_ISSUER:
#   node ~/.config/thermus/with-workos-staging.cjs test/acceptance/work-slice/auth-workos-mcp-url-fetch/auth-workos-mcp-url-fetch.sh
# You can start the script from any directory. The script gives its arguments to the entry point.
# The script sets the other settings of the slice to their defaults. A setting with a value before the call keeps that
# value. These values come before the values in .env.local, because the slice uses an exported value first.
# AXIOM_API_KEY is not in this file. Set it in the shell or in .env.local at the repository root.
# The script never writes WORKOS_API_KEY, WORKOS_COOKIE_PASSWORD, or AXIOM_API_KEY.
set -euo pipefail

# CDPATH= keeps cd silent, so that root gets only the path.
root=$(CDPATH= cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd -P)
script="$root/test/acceptance/work-slice/auth-workos-mcp-url-fetch/auth-workos-mcp-url-fetch.sh"
# The slice reads .env.local from the current directory, and pnpm runs the package script from the root.
cd "$root"

# The WorkOS settings have no default. The message names each missing setting and shows no value.
missing=
for name in WORKOS_API_KEY WORKOS_CLIENT_ID WORKOS_AUTHKIT_ISSUER; do
  if [[ -z "${!name:-}" ]]; then missing="${missing:+$missing, }$name"; fi
done
if [[ -n "$missing" ]]; then
  printf 'Missing or empty: %s. Start the slice through the staging launcher, which sets the WorkOS settings:\n  node ~/.config/thermus/with-workos-staging.cjs "%s"\n' "$missing" "$script" >&2
  exit 1
fi

export DEPLOYMENT="${DEPLOYMENT:-hosted}"
# The HTTPS front of the slice listens at this origin, and WorkOS Staging has the URIs of this origin.
export PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-https://localhost:46443}"
export WORKOS_REDIRECT_URI="${WORKOS_REDIRECT_URI:-${PUBLIC_BASE_URL%/}/callback}"
# A new value for each start ends the browser sessions of the start before. A plain assignment stops the script when
# openssl fails; export would hide the failure.
WORKOS_COOKIE_PASSWORD="${WORKOS_COOKIE_PASSWORD:-$(openssl rand -base64 32)}"
export WORKOS_COOKIE_PASSWORD
export AD_RULES_FILE="${AD_RULES_FILE:-$root/ad-rules.txt}"
# The recipe of docs/lightpanda-runtime.md installs the pinned release here.
export LIGHTPANDA_BIN="${LIGHTPANDA_BIN:-$root/.cache/lightpanda/1.0.0/lightpanda}"
# The settings reader uses this spelling: AXOIM.
export AXOIM_ENDPOINT_URL="${AXOIM_ENDPOINT_URL:-https://us-east-1.aws.edge.axiom.co}"
export AXIOM_SYSTEM_LOG_TEST_DATA_SET="${AXIOM_SYSTEM_LOG_TEST_DATA_SET:-system-log-test}"
# Git ignores .cache/. The certificate stays, so that the browser and Claude Code trust it one time.
export THERMUS_TLS_DIR="${THERMUS_TLS_DIR:-$root/.cache/thermus-local-tls}"
# Only this slice enrolls eligible Google users in its configured staging organization.
export THERMUS_SLICE_ORGANIZATION_ID="${THERMUS_SLICE_ORGANIZATION_ID:-org_01M4YYEQ6V2ZBM3RQEEV8CKFEA}"

# The slice checks the renderer and the Axiom key itself, with its own messages.
if [[ ! -f "$AD_RULES_FILE" ]]; then
  printf 'AD_RULES_FILE=%s is not a file. For no ad rules, make an empty file: touch "%s"\n' "$AD_RULES_FILE" "$AD_RULES_FILE" >&2
  exit 1
fi
portal_build="$root/src/user-portal/dist/index.html"
if [[ ! -f "$portal_build" ]]; then
  printf 'The portal build %s is missing. Make it in the repository root: npm run build:user-portal\n' "$portal_build" >&2
  exit 1
fi

# The browser trusts this certificate as a root, so only the owner can read its key. macOS requires the serverAuth
# key usage of a TLS server certificate.
if [[ ! -f "$THERMUS_TLS_DIR/key.pem" || ! -f "$THERMUS_TLS_DIR/cert.pem" ]]; then
  printf 'Making a new self-signed certificate for localhost in %s, because key.pem or cert.pem is missing there. Trust it as the instructions of the slice say.\n' "$THERMUS_TLS_DIR" >&2
  (
    umask 077
    mkdir -p "$THERMUS_TLS_DIR"
    openssl req -x509 -newkey rsa:2048 -nodes -keyout "$THERMUS_TLS_DIR/key.pem" -out "$THERMUS_TLS_DIR/cert.pem" -days 365 \
      -subj /CN=localhost -addext subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1 -addext extendedKeyUsage=serverAuth
  )
fi

printf '%s\n' \
  "DEPLOYMENT=$DEPLOYMENT" \
  "PUBLIC_BASE_URL=$PUBLIC_BASE_URL" \
  "WORKOS_CLIENT_ID=$WORKOS_CLIENT_ID" \
  "WORKOS_AUTHKIT_ISSUER=$WORKOS_AUTHKIT_ISSUER" \
  "WORKOS_REDIRECT_URI=$WORKOS_REDIRECT_URI" \
  "AD_RULES_FILE=$AD_RULES_FILE" \
  "LIGHTPANDA_BIN=$LIGHTPANDA_BIN" \
  "AXOIM_ENDPOINT_URL=$AXOIM_ENDPOINT_URL" \
  "AXIOM_SYSTEM_LOG_TEST_DATA_SET=$AXIOM_SYSTEM_LOG_TEST_DATA_SET" \
  "THERMUS_TLS_DIR=$THERMUS_TLS_DIR" \
  "THERMUS_SLICE_ORGANIZATION_ID=$THERMUS_SLICE_ORGANIZATION_ID" >&2
# pnpm exec gives the pinned Node runtime and passes a signal to its child. Thus a signal to this process stops the
# slice, as Ctrl+C does. The package script would put a shell wrapper and the tsx CLI between them.
exec pnpm exec node --import tsx test/acceptance/work-slice/auth-workos-mcp-url-fetch/auth-workos-mcp-url-fetch.ts "$@"
