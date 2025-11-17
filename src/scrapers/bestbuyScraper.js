const BaseScraper = require('./baseScraper');
const logger = require('../utils/logger');
const ProductRelevance = require('../utils/productRelevance');

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
      logger.info(`🔍 Navigating to BestBuy search: ${searchUrl}`);

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
               document.body.textContent.includes('Pardon our interruption') ||
               document.querySelector('input[name="captcha"]') !== null ||
               document.querySelector('#px-captcha') !== null;
      });

      if (hasCaptcha) {
        logger.warn('⚠️  CAPTCHA detected on BestBuy - saving screenshot');
        await page.screenshot({ path: 'bestbuy-captcha.png', fullPage: true });
        logger.error('❌ BestBuy blocked with CAPTCHA. Screenshot saved to bestbuy-captcha.png');
        return [];
      }

      // Log page title for debugging
      const pageTitle = await page.title();
      logger.debug(`📄 Page title: ${pageTitle}`);

      // Wait for search results to load - try multiple selectors
      logger.debug('⏳ Waiting for product elements...');
      const resultsLoaded = await this.waitForSelector(page, '.sku-item, .list-item, .shop-product-title, div.shop-sku-list-item', 20000);

      if (!resultsLoaded) {
        logger.warn('❌ No search results found on BestBuy');
        // Take screenshot for debugging
        try {
          await page.screenshot({ path: 'bestbuy-debug.png', fullPage: true });
          logger.info('📸 Saved BestBuy debug screenshot to bestbuy-debug.png');

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

      logger.info('✅ BestBuy product elements found');

      // Extract product information
      const products = await page.evaluate((maxResults) => {
        const results = [];
        // Try multiple selector combinations
        let productElements = document.querySelectorAll('.sku-item');
        let selectorUsed = '.sku-item';

        if (productElements.length === 0) {
          productElements = document.querySelectorAll('.list-item');
          selectorUsed = '.list-item';
        }
        if (productElements.length === 0) {
          productElements = document.querySelectorAll('.shop-sku-list-item');
          selectorUsed = '.shop-sku-list-item';
        }

        console.log(`✅ Found ${productElements.length} product elements using: ${selectorUsed}`);

        for (let i = 0; i < Math.min(productElements.length, maxResults * 3) && results.length < maxResults; i++) {
          const element = productElements[i];

          try {
            // Try multiple title selectors
            const titleElement = element.querySelector('.sku-title a') ||
                               element.querySelector('.sku-header a') ||
                               element.querySelector('h4.sku-title') ||
                               element.querySelector('.sku-title') ||
                               element.querySelector('a[class*="title"]');

            // Try multiple price selectors
            const priceElement = element.querySelector('.priceView-customer-price span[aria-hidden="true"]') ||
                               element.querySelector('.priceView-hero-price span') ||
                               element.querySelector('.priceView-customer-price') ||
                               element.querySelector('[data-testid="customer-price"]') ||
                               element.querySelector('span[class*="price"]') ||
                               element.querySelector('.priceView-layout-large span');

            // Try multiple link selectors
            const linkElement = element.querySelector('.sku-title a') ||
                              element.querySelector('.sku-header a') ||
                              element.querySelector('a[href*="/site/"]') ||
                              element.querySelector('a[href*="bestbuy.com"]') ||
                              element.querySelector('a');

            // Try multiple image selectors
            const imageElement = element.querySelector('.product-image img') ||
                                element.querySelector('img.product-image') ||
                                element.querySelector('img[class*="product"]') ||
                                element.querySelector('img');

            if (!titleElement || !priceElement) {
              console.log(`❌ Skipped product ${i + 1}: missing data (title: ${!!titleElement}, price: ${!!priceElement})`);
              continue;
            }

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

      // Filter products by relevance to search term
      const relevantProducts = ProductRelevance.filterRelevantProducts(
        formattedProducts,
        searchTerm,
        { minScore: 0.3, strictMode: false }
      );

      logger.info(`Successfully scraped ${relevantProducts.length} relevant products from BestBuy (${formattedProducts.length} total extracted)`);
      return relevantProducts;

    } catch (error) {
      logger.error('Error scraping BestBuy:', error);
      throw error;
    }
  }
}

module.exports = BestBuyScraper;
