class BaseScraper {
  constructor(name) {
    this.name = name;
    this.maxRetries = parseInt(process.env.MAX_RETRY_ATTEMPTS) || 3;
    this.retryDelay = parseInt(process.env.RETRY_DELAY) || 2000;
    this.requestDelay = parseInt(process.env.REQUEST_DELAY) || 1000;
  }

  async scrape(page, options) {
    throw new Error('scrape method must be implemented by subclass');
  }

  /**
   * Execute a function with retry logic
   * @param {Function} fn - Function to execute
   * @param {number} retries - Number of retries remaining
   * @returns {Promise} Result of the function
   */
  async withRetry(fn, retries = this.maxRetries) {
    try {
      return await fn();
    } catch (error) {
      if (retries <= 0) {
        throw error;
      }

      console.log(`Retry attempt ${this.maxRetries - retries + 1}/${this.maxRetries} after error:`, error.message);
      await this.delay(this.retryDelay);
      return this.withRetry(fn, retries - 1);
    }
  }

  /**
   * Delay execution for rate limiting
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Extract price from text with improved parsing
   * @param {string} priceText - Raw price text
   * @returns {number|null} Extracted price or null
   */
  extractPrice(priceText) {
    if (!priceText) return null;

    // For ranges like "$99.99 - $149.99", take only the first price
    // Split by common range indicators (dash, hyphen, "to")
    const firstPart = priceText.split(/\s*(-|to|–|—)\s*/i)[0];

    // Remove currency symbols and extract number
    // Handle different formats: $1,234.56, €1.234,56, etc.
    const cleanPrice = firstPart
      .replace(/[^\d.,]/g, '')
      .replace(/,(\d{3})/g, '$1')  // Remove thousand separators
      .replace(',', '.');  // Convert European decimal separator

    const price = parseFloat(cleanPrice);
    return isNaN(price) ? null : price;
  }

  /**
   * Wait for a selector with timeout
   * @param {Page} page - Puppeteer page object
   * @param {string} selector - CSS selector
   * @param {number} timeout - Timeout in ms
   * @returns {Promise<boolean>} True if found, false otherwise
   */
  async waitForSelector(page, selector, timeout = 5000) {
    try {
      await page.waitForSelector(selector, { timeout });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create a standardized product object
   * @param {string} title - Product title
   * @param {string} price - Price text
   * @param {string} url - Product URL
   * @param {string} image - Image URL
   * @param {number} rating - Product rating
   * @returns {Object} Formatted product object
   */
  createProductObject(title, price, url, image = '', rating = null) {
    return {
      title: title ? title.trim() : '',
      price: this.extractPrice(price),
      url: url || '',
      image: image || '',
      rating: rating,
      source: this.name,
      scrapedAt: new Date().toISOString()
    };
  }

  /**
   * Validate required options
   * @param {Object} options - Options to validate
   * @param {Array} required - Required field names
   * @throws {Error} If validation fails
   */
  validateOptions(options, required = []) {
    for (const field of required) {
      if (!options[field]) {
        throw new Error(`Missing required option: ${field}`);
      }
    }
  }
}

module.exports = BaseScraper;
