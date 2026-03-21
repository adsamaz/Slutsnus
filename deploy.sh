#!/bin/bash
set -e

echo "==> Pulling latest from git..."
git checkout -- package-lock.json
git pull

echo "==> Installing dependencies..."
npm install

echo "==> Generating Prisma client..."
npm run db:generate --workspace=server

echo "==> Building..."
npm run build

echo "==> Running database migrations..."
npm run db:migrate:deploy --workspace=server

echo "==> Starting server..."
pm2 restart slutsnus || pm2 start npm --name slutsnus -- run start --workspace=server
pm2 save
