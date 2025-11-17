const BaseScraper = require('./baseScraper');
const logger = require('../utils/logger');
const ProductRelevance = require('../utils/productRelevance');

class FacebookMarketplaceScraper extends BaseScraper {
  constructor() {
    super('Facebook Marketplace');
    this.baseUrl = 'https://www.facebook.com/marketplace';
  }

  async scrape(page, options = {}) {
    const { searchTerm = '', maxResults = 3 } = options;

    if (!searchTerm) {
      throw new Error('Search term is required for Facebook Marketplace scraper');
    }

    // Facebook Marketplace search URL
    const searchUrl = `${this.baseUrl}/search?query=${encodeURIComponent(searchTerm)}`;

    try {
      logger.info(`🔍 Navigating to Facebook Marketplace search: ${searchUrl}`);

      // Navigate with longer timeout
      await page.goto(searchUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      // Add random human-like delay
      const delay = 3000 + Math.random() * 2000;
      logger.debug(`⏱️  Waiting ${Math.round(delay)}ms (human-like delay)...`);
      await new Promise(resolve => setTimeout(resolve, delay));

      // Check for login wall or blocked access
      const isBlocked = await page.evaluate(() => {
        return document.body.textContent.includes('Log in to continue') ||
               document.body.textContent.includes('Create new account') ||
               document.body.textContent.includes('You must log in') ||
               document.querySelector('[name="login"]') !== null ||
               document.querySelector('[data-testid="royal_login_form"]') !== null;
      });

      if (isBlocked) {
        logger.warn('⚠️  Facebook login required - saving screenshot');
        await page.screenshot({ path: 'facebook-login-required.png', fullPage: true });
        logger.error('❌ Facebook Marketplace requires login. Screenshot saved to facebook-login-required.png');
        logger.error('❌ Note: Facebook Marketplace scraping is limited without authentication');
        return [];
      }

      // Log page title for debugging
      const pageTitle = await page.title();
      logger.debug(`📄 Page title: ${pageTitle}`);

      // Wait for marketplace listings to load - try multiple selectors
      logger.debug('⏳ Waiting for product elements...');
      const resultsLoaded = await this.waitForSelector(page,
        '[data-testid="marketplace_feed_item"], a[href*="/marketplace/item/"], div[role="article"]',
        20000
      );

      if (!resultsLoaded) {
        logger.warn('❌ No search results found on Facebook Marketplace');
        // Take screenshot for debugging
        try {
          await page.screenshot({ path: 'facebook-debug.png', fullPage: true });
          logger.info('📸 Saved Facebook debug screenshot to facebook-debug.png');

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

      logger.info('✅ Facebook Marketplace product elements found');

      // Extract product information
      const products = await page.evaluate((maxResults) => {
        const results = [];

        // Try multiple selector strategies for Facebook's dynamic content
        let productElements = document.querySelectorAll('a[href*="/marketplace/item/"]');
        let selectorUsed = 'a[href*="/marketplace/item/"]';

        if (productElements.length === 0) {
          productElements = document.querySelectorAll('[data-testid="marketplace_feed_item"]');
          selectorUsed = '[data-testid="marketplace_feed_item"]';
        }

        if (productElements.length === 0) {
          productElements = document.querySelectorAll('div[role="article"]');
          selectorUsed = 'div[role="article"]';
        }

        console.log(`✅ Found ${productElements.length} product elements using: ${selectorUsed}`);

        // Track seen URLs to avoid duplicates
        const seenUrls = new Set();

        for (let i = 0; i < Math.min(productElements.length, maxResults * 5) && results.length < maxResults; i++) {
          const element = productElements[i];

          try {
            // Try to find link element
            let linkElement = element;
            if (element.tagName !== 'A') {
              linkElement = element.querySelector('a[href*="/marketplace/item/"]') ||
                           element.querySelector('a[href*="/marketplace/"]') ||
                           element.querySelector('a');
            }

            if (!linkElement) {
              console.log(`❌ Skipped item ${i + 1}: no link found`);
              continue;
            }

            const url = linkElement.getAttribute('href');

            // Skip if we've already seen this URL
            if (!url || seenUrls.has(url)) {
              continue;
            }
            seenUrls.add(url);

            // Try multiple strategies to find title
            let title = '';
            const titleSelectors = [
              'span[dir="auto"]',
              'div[style*="webkit-line-clamp"]',
              '[role="heading"]',
              'h2',
              'h3',
              'span.d2edcug0'
            ];

            for (const selector of titleSelectors) {
              const titleEl = linkElement.querySelector(selector) || element.querySelector(selector);
              if (titleEl && titleEl.textContent.trim().length > 5) {
                title = titleEl.textContent.trim();
                break;
              }
            }

            // Try to find price
            let price = '';
            const priceSelectors = [
              'span:contains("$")',
              'div[style*="webkit-line-clamp"]',
              'span.d2edcug0'
            ];

            // Look for text that starts with $ or contains price-like patterns
            const allSpans = element.querySelectorAll('span');
            for (const span of allSpans) {
              const text = span.textContent.trim();
              if (text.match(/^\$[\d,]+/) || text.match(/\$\d/)) {
                price = text;
                break;
              }
            }

            // Try to find image
            let image = '';
            const imgElement = element.querySelector('img') || linkElement.querySelector('img');
            if (imgElement) {
              image = imgElement.getAttribute('src') ||
                     imgElement.getAttribute('data-src') ||
                     imgElement.getAttribute('data-lazy-src') || '';
            }

            if (!title || !price) {
              console.log(`❌ Skipped product ${i + 1}: missing data (title: ${!!title}, price: ${!!price})`);
              continue;
            }

            // Clean up title (remove extra whitespace)
            title = title.replace(/\s+/g, ' ').trim();

            // Clean up price
            price = price.split('\n')[0].trim(); // Take first line if multi-line

            if (title && price && url && results.length < maxResults) {
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
      const formattedProducts = products.map(product => {
        // Ensure URL is absolute
        let absoluteUrl = product.url;
        if (absoluteUrl && !absoluteUrl.startsWith('http')) {
          absoluteUrl = `https://www.facebook.com${absoluteUrl}`;
        }
        // Remove query parameters that might cause issues
        if (absoluteUrl) {
          absoluteUrl = absoluteUrl.split('?')[0];
        }

        return this.createProductObject(
          product.title,
          product.price,
          absoluteUrl,
          product.image,
          null // Facebook Marketplace doesn't show ratings
        );
      });

      // Filter products by relevance to search term
      const relevantProducts = ProductRelevance.filterRelevantProducts(
        formattedProducts,
        searchTerm,
        { minScore: 0.3, strictMode: false }
      );

      logger.info(`Successfully scraped ${relevantProducts.length} relevant products from Facebook Marketplace (${formattedProducts.length} total extracted)`);
      return relevantProducts;

    } catch (error) {
      logger.error('Error scraping Facebook Marketplace:', error);
      throw error;
    }
  }
}

module.exports = FacebookMarketplaceScraper;
