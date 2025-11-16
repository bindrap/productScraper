const BaseScraper = require('./baseScraper');
const logger = require('../utils/logger');

class BestBuyScraper extends BaseScraper {
  constructor() {
    super('BestBuy');
    this.baseUrl = 'https://www.bestbuy.com';
  }

  async scrape(page, options = {}) {
    const { searchTerm = '', maxResults = 3 } = options;

    if (!searchTerm) {
      throw new Error('Search term is required for BestBuy scraper');
    }

    const searchUrl = `${this.baseUrl}/site/searchpage.jsp?st=${encodeURIComponent(searchTerm)}`;

    try {
      logger.info(`Navigating to BestBuy search: ${searchUrl}`);
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });

      // Wait for search results to load
      const resultsLoaded = await this.waitForSelector(page, '.sku-item, .list-item, .shop-product-title', 15000);
      if (!resultsLoaded) {
        logger.warn('No search results found on BestBuy');
        return [];
      }

      // Extract product information
      const products = await page.evaluate((maxResults) => {
        const results = [];
        const productElements = document.querySelectorAll('.sku-item, .list-item');

        for (let i = 0; i < Math.min(productElements.length, maxResults * 2); i++) {
          const element = productElements[i];

          try {
            // Try multiple title selectors
            const titleElement = element.querySelector('.sku-title a') ||
                               element.querySelector('.sku-header a') ||
                               element.querySelector('h4.sku-title');

            // Try multiple price selectors
            const priceElement = element.querySelector('.priceView-customer-price span[aria-hidden="true"]') ||
                               element.querySelector('.priceView-hero-price span') ||
                               element.querySelector('.priceView-customer-price') ||
                               element.querySelector('[data-testid="customer-price"]');

            // Try multiple link selectors
            const linkElement = element.querySelector('.sku-title a') ||
                              element.querySelector('.sku-header a') ||
                              element.querySelector('a[href*="/site/"]');

            // Try multiple image selectors
            const imageElement = element.querySelector('.product-image img') ||
                                element.querySelector('img.product-image') ||
                                element.querySelector('img');

            if (!titleElement || !priceElement) continue;

            let title = titleElement.textContent.trim();
            let price = priceElement.textContent.trim();
            const relativeUrl = linkElement ? linkElement.getAttribute('href') : '';

            // Get high-quality image
            let image = '';
            if (imageElement) {
              image = imageElement.getAttribute('src') || imageElement.getAttribute('data-src') || '';
            }

            // Clean up price
            price = price.replace(/Your price for this item is\s*/gi, '')
                       .replace(/Sale Price\s*/gi, '')
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

      logger.info(`Successfully scraped ${formattedProducts.length} products from BestBuy`);
      return formattedProducts;

    } catch (error) {
      logger.error('Error scraping BestBuy:', error);
      throw error;
    }
  }
}

module.exports = BestBuyScraper;
