#!/bin/bash
# Startup wrapper for Flomation Editor
# This script generates run-config.js based on environment variables
# and then starts the Node.js server

set -e

# Detect the bundled Node.js binary
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_BIN="${SCRIPT_DIR}/nodejs/bin/node"

# Fallback to system node if bundled node doesn't exist (for development)
if [ ! -x "${NODE_BIN}" ]; then
    NODE_BIN="$(which node)"
    echo "Warning: Bundled Node.js not found, using system Node.js: ${NODE_BIN}"
fi

# Default values (can be overridden by environment variables)
AUTOMATE_API_URL="${AUTOMATE_API_URL:-http://localhost:8080}"
TRIGGER_URL="${TRIGGER_URL:-http://localhost:8081}"
LOGIN_URL="${LOGIN_URL:-http://localhost:8081}"

# Generate run-config.js (skip if already exists)
if [ ! -f "${SCRIPT_DIR}/build/client/run-config.js" ]; then
    cat > "${SCRIPT_DIR}/build/client/run-config.js" << EOF
window.properties = {
    AUTOMATE_API_URL: '${AUTOMATE_API_URL}',
    TRIGGER_URL: '${TRIGGER_URL}',
    LOGIN_URL: '${LOGIN_URL}'
}
EOF
    echo "Generated run-config.js"
else
    echo "run-config.js already exists, skipping generation"
fi

# Log configuration
echo "Flomation Editor starting with configuration:"
echo "  Node.js: ${NODE_BIN}"
echo "  AUTOMATE_API_URL: ${AUTOMATE_API_URL}"
echo "  TRIGGER_URL: ${TRIGGER_URL}"
echo "  LOGIN_URL: ${LOGIN_URL}"
echo "  PORT: ${PORT:-8080}"

# Start the Node.js server using react-router-serve
cd "${SCRIPT_DIR}"
exec "${NODE_BIN}" ./node_modules/@react-router/serve/dist/cli.js ./build/server/index.js
