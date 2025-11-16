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
        const productElements = document.querySelectorAll('.s-item:not(.s-item--watch-at-auction)');

        for (let i = 0; i < productElements.length && results.length < maxResults; i++) {
          const element = productElements[i];

          try {
            const titleElement = element.querySelector('.s-item__title');
            const priceElement = element.querySelector('.s-item__price');
            const linkElement = element.querySelector('.s-item__link');
            const imageElement = element.querySelector('.s-item__image-wrapper img, .s-item__image img');

            if (!titleElement) continue;

            let title = titleElement.textContent.trim();
            const price = priceElement ? priceElement.textContent.trim() : '';
            const url = linkElement ? linkElement.getAttribute('href') : '';

            // Get high-quality image
            let image = '';
            if (imageElement) {
              image = imageElement.getAttribute('src') || imageElement.getAttribute('data-src') || '';
            }

            // Skip non-product items
            if (title.includes('Shop on eBay') || title.includes('Related:')) {
              continue;
            }

            // Clean up title
            title = title.replace(/\s+/g, ' ').trim();

            if (title && price && url) {
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