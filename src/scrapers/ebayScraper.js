const BaseScraper = require('./baseScraper');
const logger = require('../utils/logger');

class EbayScraper extends BaseScraper {
  constructor() {
    super('eBay');
    this.baseUrl = 'https://www.ebay.com';
  }

  async scrape(page, options = {}) {
    const { searchTerm = '', maxResults = 3 } = options;

    if (!searchTerm) {
      throw new Error('Search term is required for eBay scraper');
    }

    const searchUrl = `${this.baseUrl}/sch/i.html?_nkw=${encodeURIComponent(searchTerm)}`;

    try {
      logger.info(`Navigating to eBay search: ${searchUrl}`);
      await page.goto(searchUrl, { waitUntil: 'networkidle2' });

      // Wait for search results to load
      const resultsLoaded = await this.waitForSelector(page, '.s-item');
      if (!resultsLoaded) {
        logger.warn('No search results found on eBay');
        return [];
      }

      // Extract product information
      const products = await page.evaluate((maxResults) => {
        const results = [];
        const productElements = document.querySelectorAll('.s-item');

        for (let i = 0; i < Math.min(productElements.length, maxResults); i++) {
          const element = productElements[i];

          // Skip sponsored results or ads
          if (element.querySelector('.s-item__title').textContent.includes('Shop on eBay')) {
            continue;
          }

          try {
            const titleElement = element.querySelector('.s-item__title');
            const priceElement = element.querySelector('.s-item__price');
            const linkElement = element.querySelector('.s-item__link');
            const imageElement = element.querySelector('.s-item__image img');

            const title = titleElement ? titleElement.textContent.trim() : '';
            const price = priceElement ? priceElement.textContent.trim() : '';
            const url = linkElement ? linkElement.getAttribute('href') : '';
            const image = imageElement ? imageElement.getAttribute('src') : '';

            if (title && price && !title.includes('Shop on eBay')) {
              results.push({
                title,
                price,
                url,
                image
              });
            }
          } catch (error) {
            console.log('Error extracting product data:', error);
          }
        }

        return results;
      }, maxResults);

      // Create product objects
      const formattedProducts = products.map(product =>
        this.createProductObject(
          product.title,
          product.price,
          product.url,
          product.image
        )
      );

      logger.info(`Successfully scraped ${formattedProducts.length} products from eBay`);
      return formattedProducts;

    } catch (error) {
      logger.error('Error scraping eBay:', error);
      throw error;
    }
  }
}

module.exports = EbayScraper;