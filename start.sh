#!/usr/bin/env bash
# TriChat Bridge — start script (Mac / Linux)
cd "$(dirname "$0")"
if [ ! -d node_modules ]; then
  echo "First run detected — installing dependencies (one time)..."
  npm install
fi
node server.js
