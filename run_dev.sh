#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "=== Menu Design: Starting Application ==="

# Check virtual environment
if [ ! -d "backend/.venv" ]; then
    echo "Creating virtual environment in backend/.venv..."
    python3 -m venv backend/.venv
    source backend/.venv/bin/activate
    pip install -r backend/requirements.txt
else
    source backend/.venv/bin/activate
fi

# Ensure frontend is built if dist doesn't exist
if [ ! -d "frontend/dist" ]; then
    echo "Building frontend static assets..."
    cd frontend && npm install && npm run build && cd ..
fi

echo "Starting unified server at http://localhost:8000"
echo "API docs available at http://localhost:8000/docs"
cd backend
exec python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
