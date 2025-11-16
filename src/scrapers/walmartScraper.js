const BaseScraper = require('./baseScraper');
const logger = require('../utils/logger');

class WalmartScraper extends BaseScraper {
  constructor() {
    super('Walmart');
    this.baseUrl = 'https://www.walmart.com';
  }

  async scrape(page, options = {}) {
    const { searchTerm = '', maxResults = 3 } = options;

    if (!searchTerm) {
      throw new Error('Search term is required for Walmart scraper');
    }

    const searchUrl = `${this.baseUrl}/search?q=${encodeURIComponent(searchTerm)}`;

    try {
      logger.info(`Navigating to Walmart search: ${searchUrl}`);
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });

      // Wait for search results to load
      const resultsLoaded = await this.waitForSelector(page, '[data-item-id], [data-testid="list-view"]');
      if (!resultsLoaded) {
        logger.warn('No search results found on Walmart');
        return [];
      }

      // Extract product information
      const products = await page.evaluate((maxResults) => {
        const results = [];
        const productElements = document.querySelectorAll('[data-item-id]');

        for (let i = 0; i < Math.min(productElements.length, maxResults); i++) {
          const element = productElements[i];

          try {
            const titleElement = element.querySelector('[data-automation-id="product-title"], span[data-automation-id="product-title"]');
            const priceElement = element.querySelector('[data-automation-id="product-price"] .w_iUH7, [itemprop="price"]');
            const linkElement = element.querySelector('a[link-identifier]');
            const imageElement = element.querySelector('img[data-testid="productTileImage"], img');
            const ratingElement = element.querySelector('[data-testid="product-ratings"]');

            const title = titleElement ? titleElement.textContent.trim() : '';
            let price = priceElement ? priceElement.textContent.trim() : '';
            const relativeUrl = linkElement ? linkElement.getAttribute('href') : '';
            const image = imageElement ? imageElement.getAttribute('src') : '';
            const ratingText = ratingElement ? ratingElement.getAttribute('aria-label') : '';
            const rating = ratingText ? parseFloat(ratingText.match(/(\d+\.?\d*)/)?.[1]) : null;

            // Clean up price
            price = price.replace('current price Now ', '').replace('current price ', '');

            if (title && price && relativeUrl) {
              results.push({
                title,
                price,
                url: relativeUrl,
                image,
                rating
              });
            }
          } catch (error) {
            console.log('Error extracting product data:', error);
          }
        }

        return results;
      }, maxResults);

      // Create product objects
      const formattedProducts = products.map(product => {
        const absoluteUrl = product.url.startsWith('http')
          ? product.url
          : `${this.baseUrl}${product.url}`;

        return this.createProductObject(
          product.title,
          product.price,
          absoluteUrl,
          product.image,
          product.rating
        );
      });

      logger.info(`Successfully scraped ${formattedProducts.length} products from Walmart`);
      return formattedProducts;

    } catch (error) {
      logger.error('Error scraping Walmart:', error);
      throw error;
    }
  }
}

module.exports = WalmartScraper;
