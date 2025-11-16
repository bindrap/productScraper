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
      const resultsLoaded = await this.waitForSelector(page, '.sku-item, .list-item');
      if (!resultsLoaded) {
        logger.warn('No search results found on BestBuy');
        return [];
      }

      // Extract product information
      const products = await page.evaluate((maxResults) => {
        const results = [];
        const productElements = document.querySelectorAll('.sku-item, .list-item');

        for (let i = 0; i < Math.min(productElements.length, maxResults); i++) {
          const element = productElements[i];

          try {
            const titleElement = element.querySelector('.sku-title a, .sku-header a');
            const priceElement = element.querySelector('.priceView-customer-price span[aria-hidden="true"], .priceView-hero-price span');
            const linkElement = element.querySelector('.sku-title a, .sku-header a');
            const imageElement = element.querySelector('.product-image img, img.product-image');
            const ratingElement = element.querySelector('.c-reviews');

            const title = titleElement ? titleElement.textContent.trim() : '';
            let price = priceElement ? priceElement.textContent.trim() : '';
            const relativeUrl = linkElement ? linkElement.getAttribute('href') : '';
            const image = imageElement ? imageElement.getAttribute('src') : '';
            const ratingText = ratingElement ? ratingElement.textContent.trim() : '';
            const rating = ratingText ? parseFloat(ratingText.match(/(\d+\.?\d*)/)?.[1]) : null;

            // Clean up price
            price = price.replace('Your price for this item is ', '');

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

      logger.info(`Successfully scraped ${formattedProducts.length} products from BestBuy`);
      return formattedProducts;

    } catch (error) {
      logger.error('Error scraping BestBuy:', error);
      throw error;
    }
  }
}

module.exports = BestBuyScraper;
