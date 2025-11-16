# Setup Guide

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Install Chrome for Puppeteer

**Option A: Use the install script (recommended)**
```bash
./install-chrome.sh
```

**Option B: Manual install**
```bash
npx puppeteer browsers install chrome
```

### 3. Start the Application

```bash
npm run web
```

Then open: **http://localhost:3000**

## Available Websites

The scraper now supports **5 major retailers**:
- ✅ Amazon
- ✅ eBay
- ✅ Newegg
- ✅ Walmart
- ✅ Best Buy

## Features

### Multi-User Authentication
- Register with username, email, and password
- 30-day session persistence
- Secure JWT tokens with HTTP-only cookies

### Friends & Sharing
- Add friends by username
- Accept/decline friend requests
- Share your scraping jobs with friends
- View jobs shared with you

### Product Scraping
- Search across multiple websites simultaneously
- Real-time progress updates via WebSocket
- Results saved to your account
- Email notifications (optional)

## Troubleshooting

### "Could not find Chrome" Error

If you see this error when trying to scrape:
```
Error: Could not find Chrome (ver. 142.0.7444.162)
```

**Solution:** Install Chrome for Puppeteer:
```bash
npx puppeteer browsers install chrome
```

### "User not found" Error

When adding a friend, you'll get this error if the username doesn't exist.
Make sure your friend has registered first!

### Port 3000 Already in Use

Kill the existing process:
```bash
# Linux/Mac
lsof -ti:3000 | xargs kill -9

# Or just stop the running server with Ctrl+C
```

## Development

```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Start with auto-reload
npm run web:dev
```

## Environment Variables

Create a `.env` file:

```env
# Email Configuration (optional - for email notifications)
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# JWT Secret (change in production!)
JWT_SECRET=your-secret-key-change-this-in-production

# Log Level
LOG_LEVEL=info
```

## Database

The application uses SQLite with automatic directory creation:
- Database: `data/scraper.db`
- Logs: `logs/combined.log` and `logs/error.log`

These directories are created automatically on first run.
