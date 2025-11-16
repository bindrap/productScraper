const puppeteer = require('puppeteer');
const logger = require('./utils/logger');
const ScraperRegistry = require('./utils/scraperRegistry');

class ProductScraper {
  constructor() {
    this.browser = null;
    this.scraperRegistry = new ScraperRegistry();
  }

  async initialize() {
    try {
      logger.info('Initializing browser...');
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      logger.info('Browser initialized successfully');
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

      // Set a realistic user agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');

      const results = await scraper.scrape(page, options);
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