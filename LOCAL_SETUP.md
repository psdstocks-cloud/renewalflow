# Local Testing Setup

Your project is now ready for local testing! Here's what has been set up:

## ✅ Completed Setup

1. **Backend Dependencies**: Installed all npm packages
2. **Frontend Dependencies**: Installed all npm packages  
3. **Database**: PostgreSQL database `renewalflow` created and migrations applied
4. **Environment Files**: Created `.env` files for both frontend and backend
5. **TypeScript Errors**: All fixed and code compiles successfully

## 🚀 Running the Application

### Backend Server (Port 4000)

```bash
cd server
npm run dev
```

The server will start on `http://localhost:4000`

### Frontend (Port 3000)

In a new terminal:

```bash
# From project root
npm run dev
```

The frontend will start on `http://localhost:3000`

## ⚙️ Environment Configuration

### Backend (`server/.env`)

You need to update these values with your actual credentials:

- `GEMINI_API_KEY`: Your Google Gemini API key
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`: Your email service credentials
- `SMTP_FROM_EMAIL`: Your sender email address
- `ADMIN_API_KEY`: Change from the default `dev-admin-key-change-in-production`

The database is already configured to use your local PostgreSQL.

### Frontend (`.env.local`)

- `GEMINI_API_KEY`: Your Google Gemini API key (same as backend)

## 🧪 Testing

1. **Health Check**: Visit `http://localhost:4000/health` to verify the backend is running
2. **Frontend**: Visit `http://localhost:3000` to see the application
3. **API**: All API routes require the `x-admin-api-key` header with your `ADMIN_API_KEY` value

## 📝 Notes

- The database is using PostgreSQL on `localhost:5432`
- Default admin API key is set to `dev-admin-key-change-in-production` (change this!)
- SMTP settings are required for email functionality to work
- Gemini API key is optional but needed for AI features

## 🔧 Troubleshooting

If you encounter issues:

1. **Database connection errors**: Make sure PostgreSQL is running (`brew services start postgresql@15`)
2. **Port already in use**: Change the `PORT` in `server/.env` or frontend port in `vite.config.ts`
3. **Missing dependencies**: Run `npm install` in both root and `server/` directories

