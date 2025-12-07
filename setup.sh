#!/bin/bash

# Memory Node MCP - Easy Setup Script

echo "🧠 Memory Node Setup"
echo "===================="

# 1. Environment Parsing
if [ ! -f .env ]; then
    echo "📝 Creating .env from defaults..."
    cp .env.example .env
    echo "✅ .env created. PLEASE EDIT IT with your API keys!"
else
    echo "✅ .env already exists."
fi

# 2. Tailscale Check
echo "🔍 Checking network configuration..."
if command -v tailscale >/dev/null 2>&1; then
    echo "✅ Tailscale found."
    TAILSCALE_STATUS=$(tailscale status --self 2>/dev/null)
    if [[ $? -eq 0 ]]; then
        echo "   Tailscale is running."
    else
        echo "⚠️  Tailscale is installed but might not be running. Please run 'sudo tailscale up'."
    fi
else
    echo "❌ Tailscale NOT found."
    echo ""
    echo "IMPORTANT: This node works best when secured via Tailscale."
    echo "Please install it: https://tailscale.com/download"
    echo ""
    echo "Alternatively, if you want to expose this publicly, verify you have a secure tunnel (e.g. Cloudflare Tunnel)."
    echo ""
    read -p "Do you want to continue anyway? (y/N) " confirm
    if [[ $confirm != [yY] && $confirm != [yY][eE][sS] ]]; then
        echo "Aborting setup."
        exit 1
    fi
fi

# 3. Install & Build
echo "📦 Installing dependencies..."
npm install

echo "🛠️  Building project..."
npm run build

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Setup Complete!"
    echo "To run the node:"
    echo "  node dist/index.js"
    echo ""
    echo "Don't forget to edit .env first!"
else
    echo "❌ Build failed. Please check the errors above."
    exit 1
fi
