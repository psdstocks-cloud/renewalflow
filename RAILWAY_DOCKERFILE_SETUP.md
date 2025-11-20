# Railway Dockerfile Setup

## Problem

Railway is detecting your service as a frontend (using Railpack) instead of using the Dockerfile for the backend.

## Solution

### Option 1: Configure Service in Railway Dashboard (Recommended)

1. Go to **Railway Dashboard → Your Service → Settings**
2. Scroll to **"Build & Deploy"** section
3. Set **"Root Directory"** to: `server` (leave empty if Dockerfile is at root)
4. Set **"Build Command"** to: (leave empty - Dockerfile handles this)
5. Set **"Start Command"** to: (leave empty - Dockerfile handles this)
6. Make sure **"Builder"** is set to **"Dockerfile"** (not Railpack/Nixpacks)
7. Save and redeploy

### Option 2: Delete Conflicting Files

The `nixpacks.toml` file has been deleted. If Railway still uses Railpack:

1. Make sure `railway.json` exists with Dockerfile configuration
2. In Railway Dashboard → Service Settings:
   - **Builder**: Select "Dockerfile" explicitly
   - **Dockerfile Path**: `Dockerfile` (if at root) or leave empty
   - **Root Directory**: Leave empty (Dockerfile is at root)

### Option 3: Force Dockerfile Build

If Railway still auto-detects as frontend:

1. Go to **Railway Dashboard → Service → Settings → Build**
2. Under **"Build Configuration"**:
   - **Builder**: `DOCKERFILE`
   - **Dockerfile Path**: `Dockerfile`
   - **Build Context**: `.` (root directory)
3. Save and trigger a new deployment

## Verify Configuration

After configuring, the build logs should show:
- ✅ `[internal] load build definition from Dockerfile`
- ✅ `FROM node:20-alpine AS base`
- ❌ NOT `Railpack` or `Nixpacks`

## Current Configuration

- **Dockerfile**: Located at root (`/Dockerfile`)
- **Builds from**: `server/` directory
- **Output**: Backend API server
- **Port**: 4000 (or `$PORT` from Railway)

## Troubleshooting

### Still seeing Railpack?

1. Check Railway Dashboard → Service → Settings → Build
2. Ensure "Builder" is set to "Dockerfile" (not auto-detect)
3. Delete any `nixpacks.toml` or `railpack.toml` files
4. Make sure `railway.json` specifies `"builder": "DOCKERFILE"`

### Build fails with Dockerfile?

1. Check that `Dockerfile` exists at project root
2. Verify `server/package.json` exists
3. Check build logs for specific Docker errors

