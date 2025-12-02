#!/bin/bash
# ============================================
# HubSpot AI Optimizer - Start Script
# ============================================

echo "🚀 Starting HubSpot AI Optimizer..."
echo ""

# Check for Gemini API key
if [ -z "$GEMINI_API_KEY" ] && ! grep -q "GEMINI_API_KEY=." .env.local 2>/dev/null; then
    echo "⚠️  WARNING: No Gemini API key found!"
    echo "   AI features won't work until you add one."
    echo ""
    echo "   Get a key at: https://ai.google.dev/"
    echo "   Then add to .env.local: GEMINI_API_KEY=your-key-here"
    echo ""
fi

# Kill any existing processes
pkill -f "node.*server/index.js" 2>/dev/null
pkill -f "vite" 2>/dev/null

# Start backend server
echo "📦 Starting backend server on port 8080..."
cd server && npm run dev &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 2

# Start frontend
echo "🎨 Starting frontend on port 3000..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Both servers starting!"
echo ""

# Detect URLs
if [ -n "$CODESPACE_NAME" ]; then
    echo "🔗 Frontend: https://${CODESPACE_NAME}-3000.app.github.dev"
    echo "🔗 Backend:  https://${CODESPACE_NAME}-8080.app.github.dev"
else
    echo "🔗 Frontend: http://localhost:3000"
    echo "🔗 Backend:  http://localhost:8080"
fi

echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
