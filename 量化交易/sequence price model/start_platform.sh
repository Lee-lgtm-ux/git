#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

PYTHON="/Users/lilongjiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3"
URL="http://127.0.0.1:8877"

if nc -z 127.0.0.1 8877 >/dev/null 2>&1; then
  echo "Sequence prediction platform is already running:"
  echo "$URL"
else
  echo "Starting sequence prediction platform..."
  "$PYTHON" scripts/serve_sequence_prediction_platform.py &
  SERVER_PID=$!
  echo "Server PID: $SERVER_PID"

  for _ in {1..40}; do
    if nc -z 127.0.0.1 8877 >/dev/null 2>&1; then
      break
    fi
    sleep 0.5
  done
fi

echo "Opening $URL"
open "$URL"
echo
echo "Keep this terminal window open while using the platform."
echo "Press Control+C here to stop the server when finished."

wait
