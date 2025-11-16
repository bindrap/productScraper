const ProductScraper = require('./scraper');
const EmailService = require('./services/emailService');
const logger = require('./utils/logger');
require('dotenv').config();

async function main() {
  try {
    logger.info('Starting Product Scraper...');

    const scraper = new ProductScraper();
    const emailService = new EmailService();

    // Example usage - scrape Amazon for laptops
    const results = await scraper.scrapeWebsite('amazon', {
      searchTerm: 'laptop',
      maxResults: 3
    });

    if (results.length > 0) {
      await emailService.sendTopProducts(results);
      logger.info(`Sent email with ${results.length} top products`);
    } else {
      logger.warn('No products found');
    }

  } catch (error) {
    logger.error('Error in main process:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}

module.exports = { main };