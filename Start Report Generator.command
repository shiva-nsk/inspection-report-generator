#!/bin/bash
# Double-click this file on a Mac to start the Report Generator.
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "Node.js is not installed. Please install it from https://nodejs.org (LTS version), then try again."
  echo ""
  read -r -p "Press Enter to close..."
  exit 1
fi
node server.js
