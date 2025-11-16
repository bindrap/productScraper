# Product Scraper

A flexible and extensible web scraper for monitoring product prices across multiple e-commerce platforms. Get email notifications with the top 3 products based on your search criteria and schedule automated scraping at custom intervals.

## Features

- 🖥️ **Web Dashboard**: Modern web interface with real-time updates
- 🌐 **Multi-platform Support**: Currently supports Amazon and eBay (easily extensible)
- 📧 **Email Notifications**: Beautifully formatted HTML emails with product details
- ⏰ **Automated Scheduling**: Set custom intervals for automated scraping
- 🔧 **Modular Architecture**: Easy to add new websites and customize scrapers
- 📊 **Intelligent Sorting**: Automatically finds the best deals based on price
- 💾 **SQLite Database**: Store and track scraping history
- 🚀 **Real-time Updates**: Live job progress via WebSockets
- 🛡️ **Error Handling**: Robust error handling and logging
- ⚡ **Performance Optimized**: Efficient scraping with proper rate limiting
- 🎯 **CLI Tool**: Full-featured command-line interface

## Quick Start

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Gmail account (for email notifications)

### Installation

1. Clone the repository:
```bash
git clone git@github.com:bindrap/productScraper.git
cd productScraper
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your email credentials
```

4. Run a quick test:
```bash
npm run scrape
```

## Web Dashboard

### Start the Web Interface

```bash
npm run web
```

Open your browser to **http://localhost:3000**

The web dashboard provides:
- 📊 Real-time statistics and monitoring
- 🔍 Submit new scraping jobs with instant feedback
- 📈 View all results with search and filtering
- 📋 Track job history and status
- 📝 System logs viewer
- 🔄 Live updates as scraping happens

See [WEB_INTERFACE.md](WEB_INTERFACE.md) for complete documentation.

## Configuration

### Environment Variables

Edit the `.env` file with your settings:

```env
# Email Configuration
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password  # Use App Password for Gmail
EMAIL_RECIPIENT=recipient@example.com

# Logging
LOG_LEVEL=info
NODE_ENV=development
```

### Gmail Setup

1. Enable 2-Factor Authentication on your Google account
2. Generate an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate password for "Mail"
   - Use this password in `EMAIL_PASSWORD`

## Usage

### Basic Scraping

```bash
# Scrape Amazon for laptops
node src/index.js

# Use the scraper programmatically
npm run scrape
```

### Scheduled Scraping

1. Configure jobs in `config/config.json`:

```json
{
  "scheduledJobs": [
    {
      "name": "daily-laptop-deals",
      "schedule": "0 9 * * *",  // Every day at 9 AM
      "config": {
        "searchTerm": "laptop",
        "maxResults": 3,
        "websites": [
          {"name": "amazon", "maxResults": 2},
          {"name": "ebay", "maxResults": 1}
        ]
      }
    }
  ]
}
```

2. Start the scheduler:

```bash
npm run schedule
```

### Programmatic Usage

```javascript
const ProductScraper = require('./src/scraper');
const EmailService = require('./src/services/emailService');

async function main() {
  const scraper = new ProductScraper();
  const emailService = new EmailService();

  // Scrape a single website
  const results = await scraper.scrapeWebsite('amazon', {
    searchTerm: 'gaming laptop',
    maxResults: 5
  });

  // Send email notification
  await emailService.sendTopProducts(results, 'gaming laptop');

  // Clean up
  await scraper.close();
}
```

## Supported Websites

### Current Support

- **Amazon** (`amazon`) - Products, prices, ratings, images
- **eBay** (`ebay`) - Products, prices, images

### Adding New Websites

1. Create a new scraper in `src/scrapers/`:

```javascript
const BaseScraper = require('./baseScraper');

class YourSiteScraper extends BaseScraper {
  constructor() {
    super('YourSite');
    this.baseUrl = 'https://yoursite.com';
  }

  async scrape(page, options = {}) {
    // Implement scraping logic
    // Return array of product objects
  }
}

module.exports = YourSiteScraper;
```

2. Register the scraper in `src/utils/scraperRegistry.js`:

```javascript
const YourSiteScraper = require('../scrapers/yourSiteScraper');

registerDefaultScrapers() {
  // ... existing scrapers
  this.registerScraper('yoursite', new YourSiteScraper());
}
```

## API Reference

### ProductScraper

```javascript
const scraper = new ProductScraper();

// Scrape a website
await scraper.scrapeWebsite(websiteName, options);

// Scrape multiple websites
await scraper.scrapeMultipleWebsites([
  { name: 'amazon', options: { searchTerm: 'laptop', maxResults: 3 } },
  { name: 'ebay', options: { searchTerm: 'laptop', maxResults: 2 } }
]);

// Close browser
await scraper.close();
```

### EmailService

```javascript
const emailService = new EmailService();

// Send top products email
await emailService.sendTopProducts(products, searchTerm);

// Test email connection
await emailService.testEmailConnection();
```

### ScrapingScheduler

```javascript
const scheduler = new ScrapingScheduler();

// Schedule custom job
await scheduler.scheduleScrapingJob('job-name', '0 9 * * *', {
  searchTerm: 'laptop',
  websites: [{ name: 'amazon', maxResults: 3 }]
});

// Predefined schedules
await scheduler.scheduleDaily('daily-job', 9, 0, config);
await scheduler.scheduleWeekly('weekly-job', 1, 9, 0, config);

// Stop jobs
scheduler.stopJob('job-name');
await scheduler.stopAllJobs();
```

## Scripts

- `npm start` - Run the scraper once
- `npm run dev` - Run with nodemon (development)
- `npm run scrape` - Execute scraping script
- `npm run schedule` - Start the scheduler
- `npm test` - Run tests

## Cron Schedule Examples

```bash
# Every day at 9 AM
0 9 * * *

# Every Monday at 10 AM
0 10 * * 1

# Every hour at minute 30
30 * * * *

# Every 6 hours
0 */6 * * *

# Weekdays at 8 AM
0 8 * * 1-5
```

## Logging

Logs are saved to:
- `logs/combined.log` - All logs
- `logs/error.log` - Error logs only

Log levels: `error`, `warn`, `info`, `debug`

## Troubleshooting

### Common Issues

1. **Email not sending**:
   - Check Gmail App Password setup
   - Verify EMAIL_USER and EMAIL_PASSWORD in .env
   - Run `emailService.testEmailConnection()`

2. **Scraping failures**:
   - Websites may have anti-bot protection
   - Check if selectors need updating
   - Increase timeout in browser options

3. **Browser issues**:
   - Install required dependencies: `sudo apt-get install -y gconf-service libasound2 libatk1.0-0 libc6 libcairo2`
   - Run with `--no-sandbox` flag (already included)

### Debug Mode

```bash
LOG_LEVEL=debug npm start
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -m 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Roadmap

- [ ] Add more e-commerce platforms
- [ ] Web dashboard for managing scrapers
- [ ] Price history tracking
- [ ] Advanced filtering options
- [ ] Slack/Discord notifications
- [ ] Docker containerization
- [ ] Cloud deployment guides

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review existing issues on GitHub
3. Create a new issue with detailed information

---

**Happy Scraping!** 🛍️