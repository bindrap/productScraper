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

      // Wait for search results to load - try multiple selectors
      const resultsLoaded = await this.waitForSelector(page, '[data-component-type="s-search-result"], .s-result-item, div[data-asin]:not([data-asin=""])', 15000);
      if (!resultsLoaded) {
        logger.warn('No search results found on Amazon');
        // Take screenshot for debugging
        try {
          await page.screenshot({ path: 'amazon-debug.png' });
          logger.info('Saved Amazon debug screenshot');
        } catch (e) {}
        return [];
      }

      // Extract product information
      const products = await page.evaluate((maxResults) => {
        const results = [];
        // Try multiple selector strategies
        let productElements = document.querySelectorAll('[data-component-type="s-search-result"]');

        if (productElements.length === 0) {
          productElements = document.querySelectorAll('.s-result-item[data-asin]:not([data-asin=""])');
        }

        if (productElements.length === 0) {
          productElements = document.querySelectorAll('div[data-asin]:not([data-asin=""])');
        }

        console.log(`Found ${productElements.length} product elements on Amazon`);

        for (let i = 0; i < productElements.length && results.length < maxResults; i++) {
          const element = productElements[i];

          try {
            // Try multiple title selectors
            const titleElement = element.querySelector('h2 a span') ||
                                element.querySelector('h2 span') ||
                                element.querySelector('.s-title-instructions-style span') ||
                                element.querySelector('h2') ||
                                element.querySelector('.a-size-base-plus, .a-size-medium');

            // Try multiple price selectors
            const priceElement = element.querySelector('.a-price-whole') ||
                                element.querySelector('.a-price .a-offscreen') ||
                                element.querySelector('.a-price-fraction') ||
                                element.querySelector('.a-price span:first-child') ||
                                element.querySelector('[data-a-color="price"]');

            // Try multiple link selectors
            const linkElement = element.querySelector('h2 a') ||
                              element.querySelector('a.a-link-normal[href*="/dp/"]') ||
                              element.querySelector('a[href*="/dp/"]');

            const imageElement = element.querySelector('img.s-image') ||
                                element.querySelector('img[data-image-latency]') ||
                                element.querySelector('img');

            const ratingElement = element.querySelector('.a-icon-alt') ||
                                 element.querySelector('[aria-label*="out of"]');

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

            // Clean up title - remove "Sponsored" text and extra whitespace
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