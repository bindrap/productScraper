const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const logger = require('./utils/logger');
const ScraperRegistry = require('./utils/scraperRegistry');

// Apply stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

// User agent pool for rotation
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
];

class ProductScraper {
  constructor() {
    this.browser = null;
    this.scraperRegistry = new ScraperRegistry();
  }

  // Random delay helper
  async randomDelay(min = 1000, max = 3000) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    logger.debug(`Waiting ${delay}ms...`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  // Get random user agent
  getRandomUserAgent() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  }

  async initialize() {
    try {
      logger.info('Initializing browser with stealth mode...');
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--window-size=1920,1080',
          '--user-agent=' + this.getRandomUserAgent()
        ],
        ignoreHTTPSErrors: true
      });
      logger.info('Browser initialized successfully with stealth mode');
    } catch (error) {
      logger.error('Failed to initialize browser:', error);
      throw error;
    }
  }

  async scrapeWebsite(websiteName, options = {}) {
    if (!this.browser) {
      await this.initialize();
    }

    const scraper = this.scraperRegistry.getScraper(websiteName);
    if (!scraper) {
      throw new Error(`No scraper found for website: ${websiteName}`);
    }

    try {
      logger.info(`Starting scrape for ${websiteName} with options:`, options);
      const page = await this.browser.newPage();

      // Set random viewport
      await page.setViewport({
        width: 1920 + Math.floor(Math.random() * 100),
        height: 1080 + Math.floor(Math.random() * 100)
      });

      // Set a random realistic user agent
      const userAgent = this.getRandomUserAgent();
      await page.setUserAgent(userAgent);
      logger.debug(`Using user agent: ${userAgent}`);

      // Set extra headers to look more like a real browser
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      });

      // Randomize some browser properties
      await page.evaluateOnNewDocument(() => {
        // Overwrite the `plugins` property to use a custom getter
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5]
        });

        // Overwrite the `languages` property
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en']
        });

        // Overwrite the webdriver property
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false
        });
      });

      // Random delay before starting
      await this.randomDelay(500, 1500);

      const results = await scraper.scrape(page, options);

      // Random delay before closing
      await this.randomDelay(500, 1000);

      await page.close();

      logger.info(`Found ${results.length} products from ${websiteName}`);
      return results;
    } catch (error) {
      logger.error(`Error scraping ${websiteName}:`, error);
      throw error;
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      logger.info('Browser closed');
    }
  }

  async scrapeMultipleWebsites(websites) {
    const allResults = [];

    for (const { name, options } of websites) {
      try {
        const results = await this.scrapeWebsite(name, options);
        allResults.push(...results);
      } catch (error) {
        logger.error(`Failed to scrape ${name}:`, error);
      }
    }

    // Sort by price (ascending) and return top 3
    return allResults
      .filter(product => product.price !== null)
      .sort((a, b) => a.price - b.price)
      .slice(0, 3);
  }
}

module.exports = ProductScraper;