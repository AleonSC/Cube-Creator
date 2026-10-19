#!/usr/bin/env bash
# Runs Cube Creator from source with live reload (macOS / Linux).
# Just want to use it? Double-click Cube-Creator.html instead.
cd "$(dirname "$0")" || exit 1
command -v npm >/dev/null || { echo "Node.js is required: https://nodejs.org"; exit 1; }
[ -d node_modules ] || { echo "Installing dependencies (first run only)..."; npm install || exit 1; }
npm start
