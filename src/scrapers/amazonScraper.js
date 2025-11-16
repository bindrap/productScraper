const BaseScraper = require('./baseScraper');
const logger = require('../utils/logger');

class AmazonScraper extends BaseScraper {
  constructor() {
    super('Amazon');
    this.baseUrl = 'https://www.amazon.com';
  }

  async scrape(page, options = {}) {
    const { searchTerm = '', maxResults = 3 } = options;

    if (!searchTerm) {
      throw new Error('Search term is required for Amazon scraper');
    }

    const searchUrl = `${this.baseUrl}/s?k=${encodeURIComponent(searchTerm)}`;

    try {
      logger.info(`Navigating to Amazon search: ${searchUrl}`);
      await page.goto(searchUrl, { waitUntil: 'networkidle2' });

      // Wait for search results to load
      const resultsLoaded = await this.waitForSelector(page, '[data-component-type="s-search-result"]');
      if (!resultsLoaded) {
        logger.warn('No search results found on Amazon');
        return [];
      }

      // Extract product information
      const products = await page.evaluate((maxResults) => {
        const results = [];
        const productElements = document.querySelectorAll('[data-component-type="s-search-result"]');

        for (let i = 0; i < productElements.length && results.length < maxResults; i++) {
          const element = productElements[i];

          try {
            // Skip sponsored results
            const isSponsored = element.querySelector('[data-component-type="sp-sponsored-result"]') ||
                              element.querySelector('.AdHolder') ||
                              element.querySelector('.s-label-popover-default') ||
                              element.textContent.includes('Sponsored');

            if (isSponsored) {
              continue;
            }

            const titleElement = element.querySelector('h2 a span, .s-title-instructions-style span');
            const priceElement = element.querySelector('.a-price-whole, .a-price .a-offscreen');
            const linkElement = element.querySelector('h2 a');
            const imageElement = element.querySelector('img.s-image');
            const ratingElement = element.querySelector('.a-icon-alt');

            let title = titleElement ? titleElement.textContent.trim() : '';
            const price = priceElement ? priceElement.textContent.trim() : '';
            const relativeUrl = linkElement ? linkElement.getAttribute('href') : '';

            // Get high-quality image URL
            let image = '';
            if (imageElement) {
              image = imageElement.getAttribute('data-image-source-density-1') ||
                     imageElement.getAttribute('srcset')?.split(',')[0]?.split(' ')[0] ||
                     imageElement.getAttribute('src') || '';
            }

            const rating = ratingElement ? ratingElement.textContent.match(/(\d+\.?\d*)/)?.[1] : null;

            // Clean up title - remove "Sponsored" and extra whitespace
            title = title.replace(/sponsored/gi, '').replace(/\s+/g, ' ').trim();

            if (title && price && relativeUrl) {
              results.push({
                title,
                price,
                url: relativeUrl,
                image,
                rating: rating ? parseFloat(rating) : null
              });
            }
          } catch (error) {
            console.log('Error extracting product data:', error);
          }
        }

        return results;
      }, maxResults);

      // Convert relative URLs to absolute and create product objects
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

      logger.info(`Successfully scraped ${formattedProducts.length} products from Amazon`);
      return formattedProducts;

    } catch (error) {
      logger.error('Error scraping Amazon:', error);
      throw error;
    }
  }
}

module.exports = AmazonScraper;