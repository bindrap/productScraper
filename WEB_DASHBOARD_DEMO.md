# Web Dashboard Demo Guide

## What You Just Got! 🎉

You now have a **fully functional web dashboard** for your product scraper with real-time updates, beautiful UI, and comprehensive features!

## Quick Demo

### 1. Start the Dashboard

```bash
npm run web
```

You'll see:
```
🚀 Product Scraper Web Dashboard
📊 Dashboard: http://localhost:3000
📡 API: http://localhost:3000/api

Press Ctrl+C to stop the server
```

### 2. Open in Browser

Navigate to: **http://localhost:3000**

## Features Tour

### 📊 Statistics Dashboard

At the top, you'll see 4 real-time statistics:
- **Total Results** - All products ever scraped
- **Total Jobs** - Number of scraping jobs created
- **Last 24h Jobs** - Recent activity
- **Average Price** - Average across all products

These update automatically every 30 seconds and after each job.

### 🔍 New Scrape Tab (Main Feature!)

#### Submit a Job

1. **Enter Search Term**: e.g., "gaming laptop", "smartphone", "headphones"
2. **Select Websites**: Check Amazon, eBay, or both
3. **Set Max Results**: Choose 1-10 products per site
4. **Email Option**: Check to receive email notification
5. **Click "Start Scraping"**

#### Watch Magic Happen!

As soon as you click, you'll see:

```
Job Status
Job ID: job_1234567890_abc123
Status: RUNNING
Progress: Scraping amazon...
```

**Real-time updates appear as scraping happens:**
- "Scraping amazon..." → Shows Amazon products
- "Scraping ebay..." → Shows eBay products
- "Email sent successfully" (if enabled)
- Status changes to COMPLETED

**Products appear instantly** with:
- Product images
- Prices in bold green
- Source website
- Ratings (if available)
- Direct links to buy

### 📈 Recent Results Tab

View all scraped products:
- **Search bar** to filter by search term
- **Product cards** with images, prices, ratings
- **Direct links** to product pages
- **Sorted by most recent first**

Try searching for a term you've scraped to see all matches!

### 📋 Jobs History Tab

See all your scraping jobs:
- **Status badges** (completed, running, failed)
- **Search terms and websites used**
- **Creation timestamps**
- **Error messages** (if job failed)

Click refresh to see latest jobs.

### 📝 Logs Tab

Monitor system activity:
- **All Logs** or **Errors Only** dropdown
- **Last 100 log entries**
- **Refresh button** for latest logs
- **Terminal-style** dark theme for easy reading

Perfect for debugging!

## API Demo

The dashboard exposes a full REST API:

### Get Statistics

```bash
curl http://localhost:3000/api/stats
```

Response:
```json
{
  "totalResults": 45,
  "totalJobs": 12,
  "recentJobs": 3,
  "avgPrice": "899.99"
}
```

### Submit Job via API

```bash
curl -X POST http://localhost:3000/api/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "searchTerm": "laptop",
    "websites": ["amazon", "ebay"],
    "maxResults": 3,
    "sendEmail": false
  }'
```

Response:
```json
{
  "jobId": "job_1234567890_abc123",
  "status": "pending",
  "message": "Job created successfully"
}
```

### Get Results

```bash
curl http://localhost:3000/api/results?limit=10
```

### Search Results

```bash
curl http://localhost:3000/api/results/search/laptop
```

### Get Jobs

```bash
curl http://localhost:3000/api/jobs
```

### Get Logs

```bash
curl http://localhost:3000/api/logs/combined
```

## Real-time WebSocket Demo

The dashboard uses Socket.io for real-time updates:

```javascript
// In browser console
const socket = io();

// Subscribe to job updates
socket.emit('subscribe:job', 'job_1234567890_abc123');

// Listen for updates
socket.on('job:status', (data) => {
  console.log('Status:', data);
});

socket.on('job:results', (data) => {
  console.log('New results:', data.results);
});

socket.on('job:progress', (data) => {
  console.log('Progress:', data.message);
});
```

## Database Explorer

The dashboard uses SQLite. Explore the data:

```bash
# Install sqlite3 if needed
npm install -g sqlite3

# Open database
sqlite3 data/scraper.db

# Run queries
sqlite> SELECT COUNT(*) FROM scraping_results;
sqlite> SELECT * FROM scraping_jobs ORDER BY created_at DESC LIMIT 5;
sqlite> SELECT search_term, AVG(price) as avg_price
        FROM scraping_results
        GROUP BY search_term;
```

### Database Tables

**scraping_results**
```sql
CREATE TABLE scraping_results (
  id INTEGER PRIMARY KEY,
  job_id TEXT,
  search_term TEXT,
  website TEXT,
  title TEXT,
  price REAL,
  url TEXT,
  image TEXT,
  rating REAL,
  scraped_at DATETIME,
  created_at DATETIME
);
```

**scraping_jobs**
```sql
CREATE TABLE scraping_jobs (
  id INTEGER PRIMARY KEY,
  job_id TEXT UNIQUE,
  name TEXT,
  search_term TEXT,
  websites TEXT,
  max_results INTEGER,
  status TEXT,
  started_at DATETIME,
  completed_at DATETIME,
  error TEXT,
  created_at DATETIME
);
```

## Demo Scenarios

### Scenario 1: Compare Prices

1. Open dashboard
2. Search for "wireless mouse"
3. Select both Amazon and eBay
4. Set max results to 5
5. Click "Start Scraping"
6. Watch results appear in real-time
7. See which site has better deals!

### Scenario 2: Email Alerts

1. Make sure email is configured (`npm run validate`)
2. Search for "gaming keyboard"
3. Check "Send results via email"
4. Start scraping
5. Check your inbox for formatted email!

### Scenario 3: Historical Tracking

1. Run several scrapes for the same product (e.g., "laptop")
2. Go to Results tab
3. Search for "laptop"
4. See all historical results
5. Compare prices over time!

### Scenario 4: Monitor Logs

1. Open Logs tab
2. Select "All Logs"
3. Run a scraping job
4. Watch logs update in real-time
5. See exactly what's happening behind the scenes

## Production Tips

### Run in Background

```bash
# Install PM2
npm install -g pm2

# Start dashboard
pm2 start src/web/server.js --name scraper-web

# Monitor
pm2 logs scraper-web

# Restart
pm2 restart scraper-web

# Stop
pm2 stop scraper-web
```

### Custom Port

```bash
PORT=8080 npm run web
```

### Production Mode

```bash
NODE_ENV=production npm run web
```

## Integration with CLI

The web dashboard and CLI work together:

```bash
# Terminal 1: Web dashboard
npm run web

# Terminal 2: CLI scraping
node src/cli.js scrape -w amazon -s "laptop" -m 5

# Dashboard will show the results!
```

## Customization

### Change Theme Colors

Edit `src/web/public/style.css`:

```css
:root {
    --primary: #3498db;        /* Change to your color */
    --success: #2ecc71;
    --danger: #e74c3c;
    /* ... etc */
}
```

### Add Custom Stats

Edit `src/web/database.js`:

```javascript
getStatistics() {
  // Add your custom queries
  const yourStat = this.db.prepare('YOUR SQL').get();
  return {
    // ... existing stats
    yourStat: yourStat.value
  };
}
```

Update `src/web/public/index.html` to display it.

### Add New Tab

1. Add button in HTML:
```html
<button class="tab-button" data-tab="mytab">My Tab</button>
```

2. Add tab content:
```html
<div id="mytab-tab" class="tab-pane">
  <!-- Your content -->
</div>
```

3. Load data in `app.js`:
```javascript
if (tabName === 'mytab') loadMyTabData();
```

## Troubleshooting

### Port 3000 in Use?

```bash
PORT=8080 npm run web
```

### Database Locked?

Stop all instances:
```bash
pkill -f "node.*web/server"
npm run web
```

### Real-time Updates Not Working?

1. Check browser console (F12)
2. Look for Socket.io errors
3. Restart server
4. Try different browser

### Can't See Results?

Make sure Chrome is installed for scraping:
```bash
npx puppeteer browsers install chrome
```

## What's Next?

Try these:

1. **Run multiple jobs** - See how the dashboard handles concurrent scraping
2. **Test email notifications** - Get results delivered
3. **Explore the API** - Build your own integrations
4. **Customize the UI** - Make it your own
5. **Track price trends** - Monitor products over time

## Support

- **Web Dashboard Guide**: [WEB_INTERFACE.md](WEB_INTERFACE.md)
- **Complete Usage**: [USAGE.md](USAGE.md)
- **Quick Start**: [QUICKSTART.md](QUICKSTART.md)
- **Main README**: [README.md](README.md)

---

**Enjoy your new web dashboard!** 🚀

Start exploring with: `npm run web`
