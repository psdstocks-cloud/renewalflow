# Local Testing Guide

## Quick Start

### 1. Start the Backend Server

Open a terminal and run:

```bash
cd server
npm run dev
```

The backend will start on **http://localhost:4000**

You should see:
```
RenewalFlow API listening on port 4000
```

### 2. Start the Frontend

Open a **new terminal** and run:

```bash
# From project root
npm run dev
```

The frontend will start on **http://localhost:3000**

### 3. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000
- **Health Check**: http://localhost:4000/health

## Environment Configuration

### Frontend (`.env.local`)

Create or update `.env.local` in the project root:

```env
# API Configuration
VITE_API_BASE_URL=http://localhost:4000
VITE_ADMIN_API_KEY=dev-admin-key-change-in-production

# Gemini API (optional)
GEMINI_API_KEY=your-gemini-api-key-here
```

### Backend (`server/.env`)

The backend `.env` should already be configured with:
- Database connection (Supabase)
- SMTP settings (Brevo)
- API keys
- Admin API key

## Testing Checklist

### ✅ Backend Health Check
```bash
curl http://localhost:4000/health
```

Should return: `{"status":"ok"}`

### ✅ Frontend Connection
1. Open http://localhost:3000
2. Check browser console for any API errors
3. Verify the dashboard loads data from the backend

### ✅ API Endpoints

Test with curl (replace `YOUR_API_KEY` with your `ADMIN_API_KEY`):

```bash
# Get subscribers
curl -H "x-admin-api-key: YOUR_API_KEY" http://localhost:4000/api/subscribers

# Get stats
curl -H "x-admin-api-key: YOUR_API_KEY" http://localhost:4000/api/subscribers/stats

# Get settings
curl -H "x-admin-api-key: YOUR_API_KEY" http://localhost:4000/api/settings
```

## Common Issues

### Port Already in Use
- Backend: Change `PORT` in `server/.env`
- Frontend: Change port in `vite.config.ts` or use `npm run dev -- --port 3001`

### CORS Errors
- Ensure `FRONTEND_ORIGIN=http://localhost:3000` is set in `server/.env`

### API Connection Failed
- Verify `VITE_API_BASE_URL` in `.env.local` matches backend URL
- Check that `VITE_ADMIN_API_KEY` matches `ADMIN_API_KEY` in `server/.env`
- Ensure backend server is running

### Database Connection
- Database is already configured with Supabase
- Connection should work automatically

## Development Tips

- Backend auto-reloads on file changes (ts-node-dev)
- Frontend hot-reloads automatically (Vite)
- Check both terminal windows for errors
- Use browser DevTools Network tab to debug API calls

