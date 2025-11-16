const EmailService = require('../src/services/emailService');

describe('EmailService', () => {
  let emailService;

  beforeEach(() => {
    emailService = new EmailService();
  });

  describe('generateEmailHTML', () => {
    test('should generate HTML with products', () => {
      const products = [
        {
          title: 'Test Laptop',
          price: 999.99,
          url: 'https://example.com/laptop',
          image: 'https://example.com/laptop.jpg',
          source: 'Amazon',
          rating: 4.5
        },
        {
          title: 'Test Phone',
          price: 699.99,
          url: 'https://example.com/phone',
          image: 'https://example.com/phone.jpg',
          source: 'eBay',
          rating: null
        }
      ];

      const html = emailService.generateEmailHTML(products, 'laptop');

      expect(html).toContain('Product Scraper Report');
      expect(html).toContain('Test Laptop');
      expect(html).toContain('Test Phone');
      expect(html).toContain('$999.99');
      expect(html).toContain('$699.99');
      expect(html).toContain('Amazon');
      expect(html).toContain('eBay');
      expect(html).toContain('Rating: 4.5/5');
      expect(html).toContain('"laptop"');
    });

    test('should handle products without images', () => {
      const products = [
        {
          title: 'Test Product',
          price: 99.99,
          url: 'https://example.com/product',
          image: '',
          source: 'Test',
          rating: null
        }
      ];

      const html = emailService.generateEmailHTML(products);

      expect(html).toContain('Test Product');
      expect(html).not.toContain('<img');
    });

    test('should handle empty search term', () => {
      const products = [
        {
          title: 'Test Product',
          price: 99.99,
          url: 'https://example.com/product',
          image: '',
          source: 'Test',
          rating: null
        }
      ];

      const html = emailService.generateEmailHTML(products, '');

      expect(html).toContain('Test Product');
      expect(html).toContain('Found:</strong> 1 product(s)');
    });

    test('should format prices with two decimal places', () => {
      const products = [
        {
          title: 'Test Product',
          price: 100,
          url: 'https://example.com/product',
          image: '',
          source: 'Test',
          rating: null
        }
      ];

      const html = emailService.generateEmailHTML(products);

      expect(html).toContain('$100.00');
    });
  });
});
