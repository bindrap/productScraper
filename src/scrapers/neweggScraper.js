const BaseScraper = require('./baseScraper');
const logger = require('../utils/logger');

class NeweggScraper extends BaseScraper {
  constructor() {
    super('Newegg');
    this.baseUrl = 'https://www.newegg.com';
  }

  async scrape(page, options = {}) {
    const { searchTerm = '', maxResults = 3 } = options;

    if (!searchTerm) {
      throw new Error('Search term is required for Newegg scraper');
    }

    const searchUrl = `${this.baseUrl}/p/pl?d=${encodeURIComponent(searchTerm)}`;

    try {
      logger.info(`Navigating to Newegg search: ${searchUrl}`);
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });

      // Wait for search results to load
      const resultsLoaded = await this.waitForSelector(page, '.item-cell, .item-container');
      if (!resultsLoaded) {
        logger.warn('No search results found on Newegg');
        return [];
      }

      // Extract product information
      const products = await page.evaluate((maxResults) => {
        const results = [];
        const productElements = document.querySelectorAll('.item-cell, .item-container');

        for (let i = 0; i < Math.min(productElements.length, maxResults); i++) {
          const element = productElements[i];

          try {
            const titleElement = element.querySelector('.item-title, a.item-title');
            const priceElement = element.querySelector('.price-current strong, .price-current');
            const linkElement = element.querySelector('.item-title, a.item-title');
            const imageElement = element.querySelector('img');
            const ratingElement = element.querySelector('.item-rating');

            const title = titleElement ? titleElement.textContent.trim() : '';
            let price = priceElement ? priceElement.textContent.trim() : '';
            const url = linkElement ? linkElement.getAttribute('href') : '';
            const image = imageElement ? imageElement.getAttribute('src') : '';
            const ratingText = ratingElement ? ratingElement.getAttribute('title') : '';
            const rating = ratingText ? parseFloat(ratingText.match(/(\d+\.?\d*)/)?.[1]) : null;

            // Clean up price
            price = price.replace(/[^0-9.,]/g, '');

            if (title && price && url) {
              results.push({
                title,
                price,
                url,
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

      logger.info(`Successfully scraped ${formattedProducts.length} products from Newegg`);
      return formattedProducts;

    } catch (error) {
      logger.error('Error scraping Newegg:', error);
      throw error;
    }
  }
}

module.exports = NeweggScraper;
