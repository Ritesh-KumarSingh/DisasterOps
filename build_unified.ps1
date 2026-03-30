# build_unified.ps1
echo "🏗️ Starting Unified Deployment Build..."

# 1. Build Frontend
echo "Building Frontend..."
cd frontend
npm run build
cd ..

# 2. Cleanup Backend Static Folder
echo "Cleaning up backend/static..."
if (Test-Path backend/static) {
    Remove-Item -Recurse -Force backend/static/*
} else {
    New-Item -ItemType Directory -Path backend/static
}

# 3. Copy Build to Backend
echo "Copying build to backend/static..."
Copy-Item -Recurse frontend/dist/* backend/static/

echo "✅ Build Complete! You can now run the backend to serve everything."
echo "Run: cd backend ; uvicorn main:app"
