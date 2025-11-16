# Web Dashboard Guide

The Product Scraper now includes a modern web dashboard for managing scraping jobs, viewing results, and monitoring system logs in real-time.

## Quick Start

### Start the Web Dashboard

```bash
npm run web
```

The dashboard will be available at: **http://localhost:3000**

For development with auto-reload:
```bash
npm run web:dev
```

## Features

### 📊 Dashboard Overview

The main dashboard displays:
- **Total Results**: All products scraped
- **Total Jobs**: Number of scraping jobs created
- **Recent Jobs**: Jobs created in the last 24 hours
- **Average Price**: Average price across all products

### 🔍 New Scrape Tab

Submit new scraping jobs with:
- **Search Term**: Product to search for
- **Websites**: Select Amazon, eBay, or both
- **Max Results**: Number of products per website (1-10)
- **Email Option**: Send results via email

**Real-time Updates**:
- Live job status (pending → running → completed)
- Progress messages as scraping happens
- Results appear instantly as they're found

### 📈 Recent Results Tab

View all scraped products with:
- Product images
- Prices and ratings
- Source website
- Direct product links
- **Search filter** to find specific items

### 📋 Jobs History Tab

Track all scraping jobs:
- Job status (pending, running, completed, failed)
- Search terms and websites
- Creation timestamps
- Error messages (if failed)

### 📝 Logs Tab

View system logs:
- All logs or errors only
- Last 100 log entries
- Real-time refresh
- Formatted log display

## API Endpoints

### Statistics

```bash
GET /api/stats
```

Returns overall statistics about scraping activity.

### Results

```bash
# Get recent results
GET /api/results?limit=50

# Search results
GET /api/results/search/:searchTerm

# Get price history
GET /api/history/:searchTerm?days=30
```

### Jobs

```bash
# Get all jobs
GET /api/jobs

# Get specific job with results
GET /api/jobs/:jobId
```

### Scraping

```bash
POST /api/scrape
Content-Type: application/json

{
  "searchTerm": "laptop",
  "websites": ["amazon", "ebay"],
  "maxResults": 3,
  "sendEmail": false
}
```

### Logs

```bash
# Get combined logs
GET /api/logs/combined

# Get error logs only
GET /api/logs/error
```

### Available Scrapers

```bash
GET /api/scrapers
```

## Real-Time Features

The dashboard uses Socket.io for real-time updates:

### Events from Server

- `job:status` - Job status changed
- `job:progress` - Progress update message
- `job:results` - New results from a website
- `job:error` - Error occurred during scraping

### Example: Subscribe to Job Updates

```javascript
const socket = io();

socket.emit('subscribe:job', jobId);

socket.on('job:status', (data) => {
  console.log('Job status:', data);
});

socket.on('job:results', (data) => {
  console.log('New results:', data.results);
});
```

## Database

The web interface uses SQLite to store:

### Tables

**scraping_results**
- Product data from all scrapes
- Search terms, prices, ratings
- Images and product URLs
- Timestamps

**scraping_jobs**
- Job metadata and status
- Configuration (websites, max results)
- Start/completion times
- Error messages

### Database Location

```
data/scraper.db
```

The database is automatically created on first run.

### Data Retention

Clean old results (90+ days):

```javascript
const ScraperDatabase = require('./src/web/database');
const db = new ScraperDatabase();
db.cleanOldResults(90);
```

## Configuration

### Environment Variables

```env
# Web server port (default: 3000)
PORT=3000

# All existing scraper settings work
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
# ... etc
```

### Custom Port

```bash
PORT=8080 npm run web
```

## Programmatic Usage

### Start Server Programmatically

```javascript
const { app, server, io, db } = require('./src/web/server');

// Server starts automatically when imported
// Access at http://localhost:3000
```

### Use Database in Your Code

```javascript
const ScraperDatabase = require('./src/web/database');
const db = new ScraperDatabase();

// Get recent results
const results = db.getRecentResults(50);

// Get statistics
const stats = db.getStatistics();

// Create a job
const jobId = db.createJob({
  name: 'My Scraping Job',
  searchTerm: 'laptop',
  websites: ['amazon', 'ebay'],
  maxResults: 5
});

// Save results
db.insertResults(scrapedProducts, jobId, 'laptop');

// Clean up
db.close();
```

## Development

### Project Structure

```
src/web/
├── server.js           # Express API & Socket.io server
├── database.js         # SQLite database interface
└── public/
    ├── index.html      # Dashboard HTML
    ├── style.css       # Styling
    └── app.js          # Frontend JavaScript
```

### Adding New Features

#### Add a New API Endpoint

Edit `src/web/server.js`:

```javascript
app.get('/api/custom-endpoint', (req, res) => {
  try {
    // Your logic here
    res.json({ data: 'result' });
  } catch (error) {
    logger.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

#### Add New Database Queries

Edit `src/web/database.js`:

```javascript
getCustomData() {
  const stmt = this.db.prepare(`
    SELECT * FROM scraping_results
    WHERE custom_condition = ?
  `);
  return stmt.all('value');
}
```

#### Add Frontend Features

Edit `src/web/public/app.js` for logic and `src/web/public/index.html` for UI.

## Deployment

### Run in Production

```bash
# Set to production mode
NODE_ENV=production npm run web
```

### Run with PM2

```bash
# Install PM2
npm install -g pm2

# Start server
pm2 start src/web/server.js --name product-scraper-web

# Monitor
pm2 status
pm2 logs product-scraper-web

# Auto-restart on reboot
pm2 startup
pm2 save
```

### Docker (Future)

Coming soon: Docker containerization for easy deployment.

## Troubleshooting

### Port Already in Use

```bash
# Use different port
PORT=8080 npm run web
```

### Database Locked

If you get "database is locked" errors:
- Close any other processes using the database
- Restart the web server

### Can't Access from Other Devices

The server binds to `localhost` by default. To allow external access, modify `server.js`:

```javascript
server.listen(PORT, '0.0.0.0', () => {
  // ...
});
```

**Warning**: Only do this on trusted networks!

### Real-time Updates Not Working

1. Check browser console for Socket.io errors
2. Ensure WebSocket connections aren't blocked by firewall
3. Restart the server

## Security Considerations

### Current Setup

The web interface is designed for **local use** and includes:
- No authentication
- No input sanitization beyond basic validation
- Database accessible to anyone with network access

### Recommended for Production

If deploying publicly, add:

1. **Authentication**: Use Passport.js or similar
2. **Input Validation**: Sanitize all user inputs
3. **Rate Limiting**: Prevent abuse
4. **HTTPS**: Use SSL certificates
5. **CORS**: Restrict allowed origins
6. **Session Management**: Secure session handling

### Basic Security Example

```javascript
// Add authentication middleware
const basicAuth = require('express-basic-auth');

app.use(basicAuth({
  users: { 'admin': 'password' },
  challenge: true
}));
```

## Performance Tips

### Optimize Database

```bash
# Run occasionally to optimize
sqlite3 data/scraper.db 'VACUUM;'
```

### Limit Results

Pagination in frontend:

```javascript
// Modify loadResults() in app.js
const page = 1;
const limit = 20;
const response = await fetch(`/api/results?limit=${limit}&offset=${(page-1)*limit}`);
```

### Cache Statistics

Implement caching for stats endpoint to reduce database load.

## FAQ

### Can I use this with the CLI?

Yes! The web dashboard and CLI work independently:

```bash
# Terminal 1: Run web dashboard
npm run web

# Terminal 2: Use CLI
node src/cli.js scrape -w amazon -s "laptop"
```

Results from CLI scrapes will appear in the web dashboard if you save them to the database.

### Can I customize the design?

Yes! Edit `src/web/public/style.css` to change colors, layout, etc.

### Can I add more websites?

Yes! Add scrapers using the existing pattern, and they'll automatically appear in the website selector.

### How do I backup my data?

Simply copy the database file:

```bash
cp data/scraper.db data/scraper.db.backup
```

## What's Next?

Potential enhancements:
- User authentication
- Price alert notifications
- Historical price charts
- Export results to CSV/JSON
- Multi-user support
- Advanced filtering
- Scheduled jobs from UI
- Mobile app

---

**Enjoy your web dashboard!** 🎉

For issues or questions, refer to the main [README.md](README.md) or [USAGE.md](USAGE.md).
