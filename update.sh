#!/bin/bash
# update.sh — Met à jour et relance La Passerelle
set -e

echo "📡 Récupération des mises à jour..."
git stash 2>/dev/null || true
git pull
git stash pop 2>/dev/null || true

echo "🔨 Build du client..."
cd client && npm run build && cd ..

echo "🚀 Lancement de La Passerelle..."
NODE_ENV=production JWT_SECRET=passerelle_secret_2026 npm start
