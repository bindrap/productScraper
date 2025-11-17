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
      logger.info(`🔍 Navigating to eBay search: ${searchUrl}`);

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
        return document.body.textContent.includes('Security Measure') ||
               document.body.textContent.includes('Please verify') ||
               document.querySelector('input[name="captcha"]') !== null ||
               document.querySelector('#captcha') !== null;
      });

      if (hasCaptcha) {
        logger.warn('⚠️  CAPTCHA detected on eBay - saving screenshot');
        await page.screenshot({ path: 'ebay-captcha.png', fullPage: true });
        logger.error('❌ eBay blocked with CAPTCHA. Screenshot saved to ebay-captcha.png');
        return [];
      }

      // Log page title for debugging
      const pageTitle = await page.title();
      logger.debug(`📄 Page title: ${pageTitle}`);

      // Wait for search results to load - try multiple selectors
      logger.debug('⏳ Waiting for product elements...');
      const resultsLoaded = await this.waitForSelector(page, '.s-item, .srp-results .s-item, ul.srp-results li', 20000);

      if (!resultsLoaded) {
        logger.warn('❌ No search results found on eBay');
        // Take screenshot for debugging
        try {
          await page.screenshot({ path: 'ebay-debug.png', fullPage: true });
          logger.info('📸 Saved eBay debug screenshot to ebay-debug.png');

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

      logger.info('✅ eBay product elements found');

      // Extract product information
      const products = await page.evaluate((maxResults) => {
        const results = [];
        // Try multiple selector combinations
        let productElements = document.querySelectorAll('.s-item');
        let selectorUsed = '.s-item';

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

        console.log(`✅ Found ${productElements.length} product elements using: ${selectorUsed}`);

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

            if (!titleElement || !priceElement) {
              console.log(`❌ Skipped product ${i + 1}: missing data (title: ${!!titleElement}, price: ${!!priceElement})`);
              continue;
            }

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
              console.log(`✅ Product ${results.length}: ${title.substring(0, 50)}... - ${price}`);
            } else {
              console.log(`❌ Skipped product ${i + 1}: missing data (title: ${!!title}, price: ${!!price}, url: ${!!url})`);
            }
          } catch (error) {
            console.log(`❌ Error extracting product ${i + 1}:`, error.message);
          }
        }

        console.log(`📊 Total products extracted: ${results.length}/${productElements.length}`);
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