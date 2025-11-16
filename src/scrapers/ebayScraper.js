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

      // Wait for search results to load - try multiple selectors
      const resultsLoaded = await this.waitForSelector(page, '.s-item, .srp-results .s-item, ul.srp-results li', 15000);
      if (!resultsLoaded) {
        logger.warn('No search results found on eBay');
        return [];
      }

      // Extract product information
      const products = await page.evaluate((maxResults) => {
        const results = [];
        // Try multiple selector combinations
        let productElements = document.querySelectorAll('.s-item');

        // Filter out non-product items (ads, related searches, etc.)
        productElements = Array.from(productElements).filter(el => {
          const title = el.querySelector('.s-item__title');
          if (!title) return false;
          const titleText = title.textContent.trim();
          // Skip non-product items
          return !titleText.includes('Shop on eBay') &&
                 !titleText.includes('Related:') &&
                 !titleText.includes('Sponsored');
        });

        for (let i = 0; i < Math.min(productElements.length, maxResults * 2) && results.length < maxResults; i++) {
          const element = productElements[i];

          try {
            // Try multiple selectors for each field
            const titleElement = element.querySelector('.s-item__title, h3.s-item__title');
            const priceElement = element.querySelector('.s-item__price, span.s-item__price');
            const linkElement = element.querySelector('.s-item__link, a.s-item__link');
            const imageElement = element.querySelector('img.s-item__image-img') ||
                                element.querySelector('.s-item__image-wrapper img') ||
                                element.querySelector('.s-item__image img') ||
                                element.querySelector('img');

            if (!titleElement || !priceElement) continue;

            let title = titleElement.textContent.trim();
            const price = priceElement.textContent.trim();
            const url = linkElement ? linkElement.getAttribute('href') : '';

            // Get high-quality image
            let image = '';
            if (imageElement) {
              image = imageElement.getAttribute('src') ||
                     imageElement.getAttribute('data-src') ||
                     imageElement.getAttribute('data-image') || '';
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