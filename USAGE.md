# Product Scraper - Detailed Usage Guide

Complete guide to using Product Scraper for all your product monitoring needs.

## Table of Contents

1. [Installation](#installation)
2. [Configuration](#configuration)
3. [Running Scrapes](#running-scrapes)
4. [Scheduling](#scheduling)
5. [Email Notifications](#email-notifications)
6. [Adding Custom Scrapers](#adding-custom-scrapers)
7. [API Reference](#api-reference)
8. [Advanced Usage](#advanced-usage)
9. [Troubleshooting](#troubleshooting)

## Installation

### Requirements
- Node.js v14 or higher
- npm or yarn
- Chrome/Chromium browser (installed automatically with Puppeteer)
- Gmail account for email notifications

### Install Dependencies

```bash
npm install
```

If you encounter issues with Puppeteer downloading Chrome:
```bash
PUPPETEER_SKIP_DOWNLOAD=true npm install
```

Then install Chrome manually or use your system's Chrome installation.

## Configuration

### Environment Variables

All configuration is done through the `.env` file. See `.env.example` for all available options.

#### Email Configuration
```env
EMAIL_SERVICE=gmail                    # Email service (currently supports gmail)
EMAIL_USER=your-email@gmail.com        # Your Gmail address
EMAIL_PASSWORD=your-app-password       # Gmail App Password (NOT regular password)
EMAIL_RECIPIENT=recipient@example.com  # Who receives the results
```

#### Scraping Settings
```env
HEADLESS_BROWSER=true                  # Run browser without GUI (true/false)
BROWSER_TIMEOUT=30000                  # Page load timeout in milliseconds
```

#### Logging
```env
LOG_LEVEL=info                         # Log level: error, warn, info, debug
NODE_ENV=development                   # Environment: development, production
```

#### Rate Limiting & Retry
```env
REQUEST_DELAY=1000                     # Delay between requests (ms)
MAX_CONCURRENT_REQUESTS=3              # Max simultaneous requests
MAX_RETRY_ATTEMPTS=3                   # How many times to retry on failure
RETRY_DELAY=2000                       # Delay before retry (ms)
```

### Scheduled Jobs Configuration

Edit `config/config.json` to set up automated scraping jobs:

```json
{
  "scheduledJobs": [
    {
      "name": "unique-job-name",
      "schedule": "0 9 * * *",
      "config": {
        "searchTerm": "your search term",
        "maxResults": 3,
        "websites": [
          {
            "name": "amazon",
            "maxResults": 2
          },
          {
            "name": "ebay",
            "maxResults": 1
          }
        ]
      }
    }
  ],
  "defaultSettings": {
    "maxResults": 3,
    "timeout": 30000,
    "retryAttempts": 3
  }
}
```

## Running Scrapes

### Method 1: NPM Scripts

```bash
# Run default scrape (from index.js)
npm start

# Scrape all websites with custom search
npm run scrape -- -s "laptop"
```

### Method 2: CLI Commands

```bash
# Scrape a single website
node src/cli.js scrape -w amazon -s "laptop" -m 5 -e

# Scrape all websites
node src/cli.js scrape-all -s "laptop" -m 3 -e

# Test email configuration
node src/cli.js test-email

# List available scrapers
node src/cli.js list-scrapers

# Show all CLI options
node src/cli.js --help
```

### Method 3: Programmatic Usage

```javascript
const ProductScraper = require('./src/scraper');
const EmailService = require('./src/services/emailService');

async function customScrape() {
  const scraper = new ProductScraper();
  const emailService = new EmailService();

  try {
    // Scrape a single website
    const amazonResults = await scraper.scrapeWebsite('amazon', {
      searchTerm: 'gaming laptop',
      maxResults: 5
    });

    console.log('Found:', amazonResults);

    // Scrape multiple websites
    const allResults = await scraper.scrapeMultipleWebsites([
      { name: 'amazon', options: { searchTerm: 'laptop', maxResults: 3 } },
      { name: 'ebay', options: { searchTerm: 'laptop', maxResults: 2 } }
    ]);

    // Send email with results
    if (allResults.length > 0) {
      await emailService.sendTopProducts(allResults, 'laptop');
    }

  } catch (error) {
    console.error('Scraping failed:', error);
  } finally {
    await scraper.close();
  }
}

customScrape();
```

## Scheduling

### Start the Scheduler

```bash
# Using npm script
npm run schedule

# Using CLI
node src/cli.js schedule
```

### Cron Expression Reference

```
 *    *    *    *    *
 │    │    │    │    │
 │    │    │    │    └─── Day of week (0-7, 0 or 7 is Sunday)
 │    │    │    └──────── Month (1-12)
 │    │    └───────────── Day of month (1-31)
 │    └────────────────── Hour (0-23)
 └─────────────────────── Minute (0-59)
```

#### Common Examples:
```bash
0 9 * * *           # Every day at 9:00 AM
0 */6 * * *         # Every 6 hours
30 8 * * 1-5        # Weekdays at 8:30 AM
0 10 * * 1          # Every Monday at 10:00 AM
0 0 1 * *           # First day of every month at midnight
*/15 * * * *        # Every 15 minutes
0 8,20 * * *        # Every day at 8 AM and 8 PM
```

### Programmatic Scheduling

```javascript
const ScrapingScheduler = require('./src/scheduler');

const scheduler = new ScrapingScheduler();

// Schedule a custom job
await scheduler.scheduleScrapingJob('my-job', '0 9 * * *', {
  searchTerm: 'laptop',
  maxResults: 3,
  websites: [
    { name: 'amazon', maxResults: 2 },
    { name: 'ebay', maxResults: 1 }
  ]
});

// Use helper methods
await scheduler.scheduleDaily('daily-job', 9, 0, config);
await scheduler.scheduleWeekly('weekly-job', 1, 9, 0, config);
await scheduler.scheduleHourly('hourly-job', 30, config);

// Stop a job
scheduler.stopJob('my-job');

// Stop all jobs
await scheduler.stopAllJobs();

// List active jobs
const jobs = scheduler.listActiveJobs();
console.log('Active jobs:', jobs);
```

## Email Notifications

### Email Format

Emails are sent as beautifully formatted HTML with:
- Report date and search term
- Product images
- Prices prominently displayed
- Ratings (when available)
- Direct links to products
- Source information

### Sending Emails

Emails are sent automatically when using the `-e` or `--email` flag with CLI commands, or when calling `emailService.sendTopProducts()` programmatically.

### Testing Email

```bash
node src/cli.js test-email
```

### Custom Email Templates

Modify the `generateEmailHTML()` method in `src/services/emailService.js` to customize the email template.

## Adding Custom Scrapers

### Step 1: Create Scraper Class

Create a new file in `src/scrapers/yourSiteScraper.js`:

```javascript
const BaseScraper = require('./baseScraper');
const logger = require('../utils/logger');

class YourSiteScraper extends BaseScraper {
  constructor() {
    super('YourSite');
    this.baseUrl = 'https://yoursite.com';
  }

  async scrape(page, options = {}) {
    const { searchTerm = '', maxResults = 3 } = options;

    // Validate required options
    this.validateOptions(options, ['searchTerm']);

    const searchUrl = `${this.baseUrl}/search?q=${encodeURIComponent(searchTerm)}`;

    try {
      logger.info(`Navigating to ${this.name} search: ${searchUrl}`);

      // Navigate with retry logic
      await this.withRetry(async () => {
        await page.goto(searchUrl, { waitUntil: 'networkidle2' });
      });

      // Wait for results
      const resultsLoaded = await this.waitForSelector(page, '.product-item');
      if (!resultsLoaded) {
        logger.warn(`No search results found on ${this.name}`);
        return [];
      }

      // Extract product data
      const products = await page.evaluate((maxResults) => {
        const results = [];
        const items = document.querySelectorAll('.product-item');

        for (let i = 0; i < Math.min(items.length, maxResults); i++) {
          const item = items[i];

          const title = item.querySelector('.product-title')?.textContent?.trim();
          const price = item.querySelector('.product-price')?.textContent?.trim();
          const url = item.querySelector('a')?.href;
          const image = item.querySelector('img')?.src;
          const rating = item.querySelector('.rating')?.textContent?.match(/(\d+\.?\d*)/)?.[1];

          if (title && price) {
            results.push({ title, price, url, image, rating: rating ? parseFloat(rating) : null });
          }
        }

        return results;
      }, maxResults);

      // Format products
      const formattedProducts = products.map(product =>
        this.createProductObject(
          product.title,
          product.price,
          product.url,
          product.image,
          product.rating
        )
      );

      logger.info(`Successfully scraped ${formattedProducts.length} products from ${this.name}`);
      return formattedProducts;

    } catch (error) {
      logger.error(`Error scraping ${this.name}:`, error);
      throw error;
    }
  }
}

module.exports = YourSiteScraper;
```

### Step 2: Register the Scraper

Edit `src/utils/scraperRegistry.js`:

```javascript
const YourSiteScraper = require('../scrapers/yourSiteScraper');

class ScraperRegistry {
  // ... existing code ...

  registerDefaultScrapers() {
    this.registerScraper('amazon', new AmazonScraper());
    this.registerScraper('ebay', new EbayScraper());
    this.registerScraper('yoursite', new YourSiteScraper()); // Add this line
    logger.info('Default scrapers registered: amazon, ebay, yoursite');
  }
}
```

### Step 3: Use Your Scraper

```bash
node src/cli.js scrape -w yoursite -s "laptop" -m 5 -e
```

## API Reference

### ProductScraper

```javascript
const scraper = new ProductScraper();

// Initialize browser
await scraper.initialize();

// Scrape single website
const results = await scraper.scrapeWebsite(websiteName, options);

// Scrape multiple websites
const results = await scraper.scrapeMultipleWebsites(websitesArray);

// Close browser
await scraper.close();
```

### EmailService

```javascript
const emailService = new EmailService();

// Send products via email
await emailService.sendTopProducts(products, searchTerm);

// Test email connection
await emailService.testEmailConnection();

// Generate HTML (for testing)
const html = emailService.generateEmailHTML(products, searchTerm);
```

### ScrapingScheduler

```javascript
const scheduler = new ScrapingScheduler();

// Schedule job
await scheduler.scheduleScrapingJob(jobName, cronExpression, config);

// Helper methods
await scheduler.scheduleDaily(jobName, hour, minute, config);
await scheduler.scheduleWeekly(jobName, dayOfWeek, hour, minute, config);
await scheduler.scheduleHourly(jobName, minute, config);

// Manage jobs
scheduler.stopJob(jobName);
await scheduler.stopAllJobs();
const jobs = scheduler.listActiveJobs();
```

## Advanced Usage

### Custom Browser Options

Modify browser launch options in `src/scraper.js`:

```javascript
this.browser = await puppeteer.launch({
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu'
  ],
  timeout: 30000
});
```

### Rate Limiting

Implement rate limiting in your scrapers:

```javascript
async scrape(page, options) {
  // Delay before scraping
  await this.delay(this.requestDelay);

  // Your scraping logic here
}
```

### Retry Logic

Use the built-in retry mechanism:

```javascript
const result = await this.withRetry(async () => {
  // Operation that might fail
  return await somethingRisky();
});
```

## Troubleshooting

### Common Issues

#### 1. Puppeteer Installation Fails
```bash
# Skip Chrome download and use system Chrome
PUPPETEER_SKIP_DOWNLOAD=true npm install
```

#### 2. Email Not Sending
- Verify Gmail App Password (not regular password)
- Check 2FA is enabled on Google account
- Run `node src/cli.js test-email`
- Check logs in `logs/error.log`

#### 3. No Products Found
- Website structure may have changed
- Try different search terms
- Check if website is accessible
- Enable debug logging: `LOG_LEVEL=debug npm start`

#### 4. Browser Errors
```bash
# Install required dependencies (Ubuntu/Debian)
sudo apt-get install -y gconf-service libasound2 libatk1.0-0 libc6 libcairo2 \
  libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 \
  libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 \
  libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 \
  libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 \
  libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 \
  libnss3 lsb-release xdg-utils wget
```

### Debug Mode

Enable verbose logging:

```env
LOG_LEVEL=debug
NODE_ENV=development
```

Check logs:
```bash
# View all logs
cat logs/combined.log

# View errors only
cat logs/error.log

# Follow logs in real-time
tail -f logs/combined.log
```

### Need More Help?

1. Check log files in `logs/` directory
2. Review GitHub issues
3. Create a new issue with:
   - Error message
   - Log output
   - Configuration (remove sensitive data)
   - Steps to reproduce

## Best Practices

1. **Rate Limiting**: Don't scrape too aggressively; respect website resources
2. **Error Handling**: Always wrap scraping code in try-catch blocks
3. **Logging**: Use appropriate log levels for debugging
4. **Testing**: Test new scrapers thoroughly before scheduling
5. **Updates**: Keep dependencies updated for security patches
6. **Privacy**: Never commit `.env` file with credentials

---

Happy Scraping!
