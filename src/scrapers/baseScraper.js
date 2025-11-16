class BaseScraper {
  constructor(name) {
    this.name = name;
  }

  async scrape(page, options) {
    throw new Error('scrape method must be implemented by subclass');
  }

  extractPrice(priceText) {
    if (!priceText) return null;

    // Remove currency symbols and extract number
    const cleanPrice = priceText
      .replace(/[^\d.,]/g, '')
      .replace(',', '');

    const price = parseFloat(cleanPrice);
    return isNaN(price) ? null : price;
  }

  async waitForSelector(page, selector, timeout = 5000) {
    try {
      await page.waitForSelector(selector, { timeout });
      return true;
    } catch (error) {
      return false;
    }
  }

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
}

module.exports = BaseScraper;