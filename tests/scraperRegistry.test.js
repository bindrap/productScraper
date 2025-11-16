const ScraperRegistry = require('../src/utils/scraperRegistry');
const AmazonScraper = require('../src/scrapers/amazonScraper');
const EbayScraper = require('../src/scrapers/ebayScraper');
const BaseScraper = require('../src/scrapers/baseScraper');

describe('ScraperRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new ScraperRegistry();
  });

  describe('registerDefaultScrapers', () => {
    test('should register amazon and ebay scrapers by default', () => {
      const available = registry.getAvailableScrapers();

      expect(available).toContain('amazon');
      expect(available).toContain('ebay');
      expect(available.length).toBe(2);
    });
  });

  describe('registerScraper', () => {
    test('should register a new scraper', () => {
      class CustomScraper extends BaseScraper {
        constructor() {
          super('Custom');
        }
      }

      const customScraper = new CustomScraper();
      registry.registerScraper('custom', customScraper);

      const available = registry.getAvailableScrapers();
      expect(available).toContain('custom');
    });

    test('should handle case-insensitive names', () => {
      class CustomScraper extends BaseScraper {
        constructor() {
          super('Custom');
        }
      }

      const customScraper = new CustomScraper();
      registry.registerScraper('CUSTOM', customScraper);

      expect(registry.getScraper('custom')).toBe(customScraper);
      expect(registry.getScraper('CUSTOM')).toBe(customScraper);
    });
  });

  describe('getScraper', () => {
    test('should return registered scraper', () => {
      const amazonScraper = registry.getScraper('amazon');

      expect(amazonScraper).toBeInstanceOf(AmazonScraper);
    });

    test('should return undefined for unregistered scraper', () => {
      const scraper = registry.getScraper('nonexistent');

      expect(scraper).toBeUndefined();
    });

    test('should be case-insensitive', () => {
      const scraper1 = registry.getScraper('amazon');
      const scraper2 = registry.getScraper('AMAZON');
      const scraper3 = registry.getScraper('Amazon');

      expect(scraper1).toBe(scraper2);
      expect(scraper2).toBe(scraper3);
    });
  });

  describe('removeScraper', () => {
    test('should remove existing scraper', () => {
      const removed = registry.removeScraper('amazon');

      expect(removed).toBe(true);
      expect(registry.getScraper('amazon')).toBeUndefined();
      expect(registry.getAvailableScrapers()).not.toContain('amazon');
    });

    test('should return false for non-existent scraper', () => {
      const removed = registry.removeScraper('nonexistent');

      expect(removed).toBe(false);
    });

    test('should be case-insensitive', () => {
      const removed = registry.removeScraper('AMAZON');

      expect(removed).toBe(true);
      expect(registry.getScraper('amazon')).toBeUndefined();
    });
  });

  describe('getAvailableScrapers', () => {
    test('should return array of scraper names', () => {
      const available = registry.getAvailableScrapers();

      expect(Array.isArray(available)).toBe(true);
      expect(available.length).toBeGreaterThan(0);
    });
  });
});
