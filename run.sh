#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d "frontend/dist" ]; then
  echo "Building 3D Greenhouse frontend..."
  (cd frontend && npm install && npm run build)
fi

echo "Starting AgroGuard Edge 3D Digital Twin on http://localhost:8000"
python3 backend/server.py
