#!/bin/bash
set -e

echo "==> Pulling latest from git..."
git pull

echo "==> Installing dependencies..."
npm install

echo "==> Building..."
npm run build

echo "==> Running database migrations..."
npm run db:migrate --workspace=server

echo "==> Starting server..."
npm run start --workspace=server
