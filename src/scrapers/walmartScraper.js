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
      const resultsLoaded = await this.waitForSelector(page, '[data-item-id], [data-testid="item-stack"]', 15000);
      if (!resultsLoaded) {
        logger.warn('No search results found on Walmart');
        return [];
      }

      // Extract product information
      const products = await page.evaluate((maxResults) => {
        const results = [];
        const productElements = document.querySelectorAll('[data-item-id], [data-testid="list-view"] > div');

        for (let i = 0; i < Math.min(productElements.length, maxResults * 2); i++) {
          const element = productElements[i];

          try {
            // Try multiple title selectors
            const titleElement = element.querySelector('[data-automation-id="product-title"]') ||
                                element.querySelector('span[data-automation-id="product-title"]') ||
                                element.querySelector('[aria-label*="link"]');

            // Try multiple price selectors
            const priceElement = element.querySelector('[data-automation-id="product-price"]') ||
                               element.querySelector('.f2') ||
                               element.querySelector('[itemprop="price"]');

            // Try multiple link selectors
            const linkElement = element.querySelector('a[link-identifier]') ||
                              element.querySelector('a[href*="/ip/"]');

            // Try multiple image selectors
            const imageElement = element.querySelector('img[data-testid="productTileImage"]') ||
                                element.querySelector('img[src*="i5.walmartimages"]') ||
                                element.querySelector('img');

            if (!titleElement || !priceElement) continue;

            let title = titleElement.textContent ? titleElement.textContent.trim() : titleElement.getAttribute('aria-label') || '';
            let price = priceElement.textContent.trim();
            const relativeUrl = linkElement ? linkElement.getAttribute('href') : '';

            // Get high-quality image
            let image = '';
            if (imageElement) {
              image = imageElement.getAttribute('src') || imageElement.getAttribute('data-src') || '';
            }

            // Clean up price - extract just the number
            price = price.replace(/current price\s*/gi, '')
                       .replace(/Now\s*/gi, '')
                       .replace(/^\$/, '')
                       .trim();

            // Clean up title
            title = title.replace(/\s+/g, ' ').trim();

            if (title && price && relativeUrl && results.length < maxResults) {
              results.push({
                title,
                price,
                url: relativeUrl,
                image,
                rating: null
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
