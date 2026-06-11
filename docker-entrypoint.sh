#!/bin/sh
# Container entrypoint for Flomation Editor.
# Generates build/client/run-config.js from environment variables on every
# start, then execs the react-router server.

set -e

AUTOMATE_API_URL="${AUTOMATE_API_URL:-http://localhost:8080}"
BILLING_API_URL="${BILLING_API_URL:-http://localhost:9085}"
TRIGGER_URL="${TRIGGER_URL:-http://localhost:8081}"
LOGIN_URL="${LOGIN_URL:-http://localhost:8081}"
LAUNCH_URL="${LAUNCH_URL:-http://localhost:8081}"

cat > /app/build/client/run-config.js << EOF
window.properties = {
    AUTOMATE_API_URL: '${AUTOMATE_API_URL}',
    BILLING_API_URL: '${BILLING_API_URL}',
    TRIGGER_URL: '${TRIGGER_URL}',
    LOGIN_URL: '${LOGIN_URL}',
    LAUNCH_URL: '${LAUNCH_URL}'
}
EOF

echo "Flomation Editor starting with configuration:"
echo "  AUTOMATE_API_URL: ${AUTOMATE_API_URL}"
echo "  BILLING_API_URL: ${BILLING_API_URL}"
echo "  TRIGGER_URL: ${TRIGGER_URL}"
echo "  LOGIN_URL: ${LOGIN_URL}"
echo "  LAUNCH_URL: ${LAUNCH_URL}"
echo "  PORT: ${PORT:-8080}"

cd /app
exec node ./node_modules/@react-router/serve/dist/cli.js ./build/server/index.js
