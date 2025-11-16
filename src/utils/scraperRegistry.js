const AmazonScraper = require('../scrapers/amazonScraper');
const EbayScraper = require('../scrapers/ebayScraper');
const logger = require('./logger');

class ScraperRegistry {
  constructor() {
    this.scrapers = new Map();
    this.registerDefaultScrapers();
  }

  registerDefaultScrapers() {
    this.registerScraper('amazon', new AmazonScraper());
    this.registerScraper('ebay', new EbayScraper());
    logger.info('Default scrapers registered: amazon, ebay');
  }

  registerScraper(name, scraperInstance) {
    this.scrapers.set(name.toLowerCase(), scraperInstance);
    logger.info(`Registered scraper: ${name}`);
  }

  getScraper(name) {
    return this.scrapers.get(name.toLowerCase());
  }

  getAvailableScrapers() {
    return Array.from(this.scrapers.keys());
  }

  removeScraper(name) {
    const removed = this.scrapers.delete(name.toLowerCase());
    if (removed) {
      logger.info(`Removed scraper: ${name}`);
    }
    return removed;
  }
}

module.exports = ScraperRegistry;