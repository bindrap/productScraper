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
      logger.info(`🔍 Navigating to Walmart search: ${searchUrl}`);

      // Navigate with longer timeout
      await page.goto(searchUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      // Add random human-like delay
      const delay = 2000 + Math.random() * 2000;
      logger.debug(`⏱️  Waiting ${Math.round(delay)}ms (human-like delay)...`);
      await new Promise(resolve => setTimeout(resolve, delay));

      // Check for CAPTCHA or bot detection
      const hasCaptcha = await page.evaluate(() => {
        return document.body.textContent.includes('Please verify') ||
               document.body.textContent.includes('Access Denied') ||
               document.querySelector('input[name="captcha"]') !== null ||
               document.querySelector('#px-captcha') !== null ||
               document.body.textContent.includes('blocked');
      });

      if (hasCaptcha) {
        logger.warn('⚠️  CAPTCHA detected on Walmart - saving screenshot');
        await page.screenshot({ path: 'walmart-captcha.png', fullPage: true });
        logger.error('❌ Walmart blocked with CAPTCHA. Screenshot saved to walmart-captcha.png');
        return [];
      }

      // Log page title for debugging
      const pageTitle = await page.title();
      logger.debug(`📄 Page title: ${pageTitle}`);

      // Wait for search results to load - try multiple selectors
      logger.debug('⏳ Waiting for product elements...');
      const resultsLoaded = await this.waitForSelector(page, '[data-item-id], [data-testid="item-stack"], .search-result-gridview-item, div[data-testid="list-view"]', 20000);

      if (!resultsLoaded) {
        logger.warn('❌ No search results found on Walmart');
        // Take screenshot for debugging
        try {
          await page.screenshot({ path: 'walmart-debug.png', fullPage: true });
          logger.info('📸 Saved Walmart debug screenshot to walmart-debug.png');

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

      logger.info('✅ Walmart product elements found');

      // Extract product information
      const products = await page.evaluate((maxResults) => {
        const results = [];
        // Try multiple selector combinations for product elements
        let productElements = document.querySelectorAll('[data-item-id]');
        let selectorUsed = '[data-item-id]';

        if (productElements.length === 0) {
          productElements = document.querySelectorAll('[data-testid="list-view"] > div');
          selectorUsed = '[data-testid="list-view"] > div';
        }
        if (productElements.length === 0) {
          productElements = document.querySelectorAll('.search-result-gridview-item');
          selectorUsed = '.search-result-gridview-item';
        }

        console.log(`✅ Found ${productElements.length} product elements using: ${selectorUsed}`);

        for (let i = 0; i < Math.min(productElements.length, maxResults * 3) && results.length < maxResults; i++) {
          const element = productElements[i];

          try {
            // Try multiple title selectors
            const titleElement = element.querySelector('[data-automation-id="product-title"]') ||
                                element.querySelector('span[data-automation-id="product-title"]') ||
                                element.querySelector('[aria-label]') ||
                                element.querySelector('span.w_V_DM') ||
                                element.querySelector('a span');

            // Try multiple price selectors
            const priceElement = element.querySelector('[data-automation-id="product-price"]') ||
                               element.querySelector('.f2, .b') ||
                               element.querySelector('[itemprop="price"]') ||
                               element.querySelector('div[data-automation-id="product-price"] span') ||
                               element.querySelector('span[class*="price"]');

            // Try multiple link selectors
            const linkElement = element.querySelector('a[link-identifier]') ||
                              element.querySelector('a[href*="/ip/"]') ||
                              element.querySelector('a[href*="walmart.com"]') ||
                              element.querySelector('a');

            // Try multiple image selectors
            const imageElement = element.querySelector('img[data-testid="productTileImage"]') ||
                                element.querySelector('img[src*="i5.walmartimages"]') ||
                                element.querySelector('img[src*="walmart"]') ||
                                element.querySelector('img');

            if (!titleElement || !priceElement) {
              console.log(`❌ Skipped product ${i + 1}: missing data (title: ${!!titleElement}, price: ${!!priceElement})`);
              continue;
            }

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
