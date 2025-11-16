# Quick Start Guide

Get started with Product Scraper in 5 minutes!

## Installation

```bash
git clone git@github.com:bindrap/productScraper.git
cd productScraper
npm install
```

## Setup

### Option 1: Interactive Setup (Recommended)

```bash
npm run setup
```

This will guide you through:
- Email configuration (Gmail + App Password)
- Scraping preferences
- Logging settings

### Option 2: Manual Setup

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` and add your Gmail credentials:
```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_RECIPIENT=recipient@example.com
```

### Getting Gmail App Password

1. Enable 2-Factor Authentication on your Google account
2. Go to: [Google Account > Security > 2-Step Verification > App passwords](https://myaccount.google.com/apppasswords)
3. Generate a password for "Mail"
4. Use this 16-character password in `.env`

## Validate Setup

```bash
npm run validate
```

This checks:
- Configuration files exist
- Required environment variables are set
- Email connection works

## Run Your First Scrape

### Quick Test
```bash
npm start
```

This runs a default scrape for "laptop" on Amazon and sends results via email.

### Custom Search
```bash
node src/cli.js scrape -w amazon -s "gaming laptop" -m 5 -e
```

### Search Multiple Websites
```bash
node src/cli.js scrape-all -s "smartphone" -m 3 -e
```

## Common Commands

```bash
# Run default scrape with email
npm start

# Scrape all websites for a term
npm run scrape -- -s "laptop"

# Start scheduler (from config.json)
npm run schedule

# Test email connection
node src/cli.js test-email

# List available scrapers
node src/cli.js list-scrapers

# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

## CLI Options

```bash
# Scrape a single website
node src/cli.js scrape -w <website> -s <search-term> [options]

Options:
  -w, --website <name>   Website to scrape (amazon, ebay)
  -s, --search <term>    Search term (required)
  -m, --max <number>     Max results (default: 3)
  -e, --email            Send results via email

# Scrape all websites
node src/cli.js scrape-all -s <search-term> [options]

Options:
  -s, --search <term>    Search term (required)
  -m, --max <number>     Max results per website (default: 3)
  -e, --email            Send results via email
```

## Scheduling

Edit `config/config.json` to configure scheduled jobs:

```json
{
  "scheduledJobs": [
    {
      "name": "daily-laptop-deals",
      "schedule": "0 9 * * *",
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

Then start the scheduler:
```bash
npm run schedule
```

## Cron Schedule Examples

```bash
0 9 * * *       # Every day at 9 AM
0 10 * * 1      # Every Monday at 10 AM
30 * * * *      # Every hour at minute 30
0 */6 * * *     # Every 6 hours
0 8 * * 1-5     # Weekdays at 8 AM
```

## Troubleshooting

### Email Not Working
- Verify you're using a Gmail App Password, not your regular password
- Check 2-Factor Authentication is enabled
- Make sure EMAIL_USER and EMAIL_PASSWORD are set in `.env`
- Run `npm run validate` to test connection

### No Products Found
- Try a different search term
- Check if the website is accessible
- Look at logs in `logs/combined.log`

### Browser Errors
- Make sure Chrome/Chromium is installed
- Set `HEADLESS_BROWSER=true` in `.env`
- Check logs for specific error messages

### Need Help?
1. Check `logs/error.log` for detailed error messages
2. Review the full README.md for detailed documentation
3. Create an issue on GitHub with error details

## What's Next?

- Read the full [README.md](README.md) for advanced features
- Customize scrapers for additional websites
- Set up automated scheduling
- Integrate with your own applications

Happy scraping!
