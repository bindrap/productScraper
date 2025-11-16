const BaseScraper = require('../src/scrapers/baseScraper');

describe('BaseScraper', () => {
  let scraper;

  beforeEach(() => {
    scraper = new BaseScraper('TestScraper');
  });

  describe('extractPrice', () => {
    test('should extract simple dollar price', () => {
      expect(scraper.extractPrice('$99.99')).toBe(99.99);
    });

    test('should extract price with comma separator', () => {
      expect(scraper.extractPrice('$1,234.56')).toBe(1234.56);
    });

    test('should extract euro price', () => {
      expect(scraper.extractPrice('€999.99')).toBe(999.99);
    });

    test('should handle price without currency symbol', () => {
      expect(scraper.extractPrice('59.99')).toBe(59.99);
    });

    test('should return null for invalid price', () => {
      expect(scraper.extractPrice('invalid')).toBeNull();
      expect(scraper.extractPrice(null)).toBeNull();
      expect(scraper.extractPrice('')).toBeNull();
    });

    test('should handle price ranges by taking first number', () => {
      const result = scraper.extractPrice('$99.99 - $149.99');
      expect(result).toBe(99.99);
    });
  });

  describe('createProductObject', () => {
    test('should create complete product object', () => {
      const product = scraper.createProductObject(
        'Test Product',
        '$99.99',
        'https://example.com/product',
        'https://example.com/image.jpg',
        4.5
      );

      expect(product).toMatchObject({
        title: 'Test Product',
        price: 99.99,
        url: 'https://example.com/product',
        image: 'https://example.com/image.jpg',
        rating: 4.5,
        source: 'TestScraper'
      });
      expect(product.scrapedAt).toBeDefined();
    });

    test('should handle missing optional fields', () => {
      const product = scraper.createProductObject(
        'Test Product',
        '$99.99',
        'https://example.com/product'
      );

      expect(product.image).toBe('');
      expect(product.rating).toBeNull();
    });

    test('should trim whitespace from title', () => {
      const product = scraper.createProductObject(
        '  Test Product  ',
        '$99.99',
        'https://example.com/product'
      );

      expect(product.title).toBe('Test Product');
    });
  });

  describe('validateOptions', () => {
    test('should pass validation with all required fields', () => {
      expect(() => {
        scraper.validateOptions({ searchTerm: 'laptop', maxResults: 3 }, ['searchTerm']);
      }).not.toThrow();
    });

    test('should throw error for missing required field', () => {
      expect(() => {
        scraper.validateOptions({}, ['searchTerm']);
      }).toThrow('Missing required option: searchTerm');
    });

    test('should pass with no required fields', () => {
      expect(() => {
        scraper.validateOptions({}, []);
      }).not.toThrow();
    });
  });

  describe('delay', () => {
    test('should delay execution', async () => {
      const start = Date.now();
      await scraper.delay(100);
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThanOrEqual(95); // Allow small margin
    });
  });

  describe('withRetry', () => {
    test('should succeed on first attempt', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const result = await scraper.withRetry(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    test('should retry on failure and eventually succeed', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success');

      const result = await scraper.withRetry(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    test('should throw after max retries', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('always fails'));

      await expect(scraper.withRetry(fn, 2)).rejects.toThrow('always fails');
      expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('scrape', () => {
    test('should throw error when not implemented', async () => {
      await expect(scraper.scrape()).rejects.toThrow('scrape method must be implemented by subclass');
    });
  });
});
