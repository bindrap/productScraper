const BaseScraper = require('./baseScraper');
const logger = require('../utils/logger');
const ProductRelevance = require('../utils/productRelevance');

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
      logger.info(`🔍 Navigating to Amazon search: ${searchUrl}`);

      // Navigate with longer timeout
      await page.goto(searchUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      // Add random human-like delay
      const delay = 2000 + Math.random() * 2000;
      logger.debug(`⏱️  Waiting ${Math.round(delay)}ms (human-like delay)...`);
      await new Promise(resolve => setTimeout(resolve, delay));

      // Check for CAPTCHA
      const hasCaptcha = await page.evaluate(() => {
        return document.body.textContent.includes('Enter the characters you see below') ||
               document.querySelector('form[action*="validateCaptcha"]') !== null;
      });

      if (hasCaptcha) {
        logger.warn('⚠️  CAPTCHA detected on Amazon - saving screenshot');
        await page.screenshot({ path: 'amazon-captcha.png', fullPage: true });
        logger.error('❌ Amazon blocked with CAPTCHA. Screenshot saved to amazon-captcha.png');
        return [];
      }

      // Log page title for debugging
      const pageTitle = await page.title();
      logger.debug(`📄 Page title: ${pageTitle}`);

      // Wait for search results to load - try multiple selectors
      logger.debug('⏳ Waiting for product elements...');
      const resultsLoaded = await this.waitForSelector(page, '[data-component-type="s-search-result"], .s-result-item, div[data-asin]:not([data-asin=""])', 20000);

      if (!resultsLoaded) {
        logger.warn('❌ No search results found on Amazon');
        // Take screenshot for debugging
        try {
          await page.screenshot({ path: 'amazon-debug.png', fullPage: true });
          logger.info('📸 Saved Amazon debug screenshot to amazon-debug.png');

          // Also log page HTML for analysis
          const bodyHTML = await page.evaluate(() => document.body.innerHTML);
          logger.debug(`📝 Page HTML length: ${bodyHTML.length} characters`);
          if (bodyHTML.length < 1000) {
            logger.error(`⚠️  Suspiciously short HTML response: ${bodyHTML.substring(0, 500)}`);
          }
        } catch (e) {
          logger.error('Failed to save debug screenshot:', e.message);
        }
        return [];
      }

      logger.info('✅ Amazon product elements found');

      // Extract product information
      const products = await page.evaluate((maxResults) => {
        const results = [];
        // Try multiple selector strategies
        let productElements = document.querySelectorAll('[data-component-type="s-search-result"]');
        let selectorUsed = '[data-component-type="s-search-result"]';

        if (productElements.length === 0) {
          productElements = document.querySelectorAll('.s-result-item[data-asin]:not([data-asin=""])');
          selectorUsed = '.s-result-item[data-asin]:not([data-asin=""])';
        }

        if (productElements.length === 0) {
          productElements = document.querySelectorAll('div[data-asin]:not([data-asin=""])');
          selectorUsed = 'div[data-asin]:not([data-asin=""])';
        }

        console.log(`✅ Found ${productElements.length} product elements using: ${selectorUsed}`);

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
              console.log(`✅ Product ${results.length}: ${title.substring(0, 50)}... - $${price}`);
            } else {
              console.log(`❌ Skipped product ${i + 1}: missing data (title: ${!!title}, price: ${!!price}, url: ${!!relativeUrl})`);
            }
          } catch (error) {
            console.log(`❌ Error extracting product ${i + 1}:`, error.message);
          }
        }

        console.log(`📊 Total products extracted: ${results.length}/${productElements.length}`);
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

      // Filter products by relevance to search term
      const relevantProducts = ProductRelevance.filterRelevantProducts(
        formattedProducts,
        searchTerm,
        { minScore: 0.3, strictMode: false }
      );

      logger.info(`Successfully scraped ${relevantProducts.length} relevant products from Amazon (${formattedProducts.length} total extracted)`);
      return relevantProducts;

    } catch (error) {
      logger.error('Error scraping Amazon:', error);
      throw error;
    }
  }
}

module.exports = AmazonScraper;