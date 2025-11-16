const ProductScraper = require('../src/scraper');
const AmazonScraper = require('../src/scrapers/amazonScraper');

describe('ProductScraper', () => {
  let scraper;

  beforeEach(() => {
    scraper = new ProductScraper();
  });

  afterEach(async () => {
    if (scraper) {
      await scraper.close();
    }
  });

  test('should initialize scraper registry', () => {
    expect(scraper.scraperRegistry).toBeDefined();
    expect(scraper.scraperRegistry.getAvailableScrapers()).toContain('amazon');
    expect(scraper.scraperRegistry.getAvailableScrapers()).toContain('ebay');
  });

  test('should throw error for unsupported website', async () => {
    await expect(scraper.scrapeWebsite('unsupported')).rejects.toThrow('No scraper found for website: unsupported');
  });
});

describe('AmazonScraper', () => {
  let amazonScraper;

  beforeEach(() => {
    amazonScraper = new AmazonScraper();
  });

  test('should create product object correctly', () => {
    const product = amazonScraper.createProductObject(
      'Test Laptop',
      '$999.99',
      'https://amazon.com/test',
      'https://image.com/test.jpg',
      4.5
    );

    expect(product.title).toBe('Test Laptop');
    expect(product.price).toBe(999.99);
    expect(product.url).toBe('https://amazon.com/test');
    expect(product.image).toBe('https://image.com/test.jpg');
    expect(product.rating).toBe(4.5);
    expect(product.source).toBe('Amazon');
  });

  test('should extract price correctly', () => {
    expect(amazonScraper.extractPrice('$99.99')).toBe(99.99);
    expect(amazonScraper.extractPrice('€1,234.56')).toBe(1234.56);
    expect(amazonScraper.extractPrice('invalid')).toBeNull();
    expect(amazonScraper.extractPrice(null)).toBeNull();
  });
});