const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    try {
      this.transporter = nodemailer.createTransporter({
        service: process.env.EMAIL_SERVICE || 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        }
      });

      logger.info('Email service initialized');
    } catch (error) {
      logger.error('Failed to initialize email service:', error);
    }
  }

  async sendTopProducts(products, searchTerm = '', recipientEmail = null) {
    if (!this.transporter) {
      throw new Error('Email service not initialized. Please check your email configuration.');
    }

    if (!products || products.length === 0) {
      logger.warn('No products to send via email');
      return;
    }

    // Use recipient email if provided, otherwise fall back to EMAIL_RECIPIENT or EMAIL_USER
    const recipient = recipientEmail || process.env.EMAIL_RECIPIENT || process.env.EMAIL_USER;

    if (!recipient) {
      throw new Error('No recipient email address provided');
    }

    try {
      const htmlContent = this.generateEmailHTML(products, searchTerm);

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: recipient,
        subject: `🛍️ ${products.length} Product Results${searchTerm ? ` for "${searchTerm}"` : ''} - Comprehensive Price Range`,
        html: htmlContent
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent successfully to ${recipient}:`, info.messageId);

      return info;
    } catch (error) {
      logger.error('Failed to send email:', error);
      throw error;
    }
  }

  generateEmailHTML(products, searchTerm = '') {
    const currentDate = new Date().toLocaleDateString();

    let html = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
            .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
            .product { border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin-bottom: 15px; }
            .product-title { font-size: 18px; font-weight: bold; color: #333; margin-bottom: 10px; }
            .product-price { font-size: 24px; color: #e74c3c; font-weight: bold; margin-bottom: 10px; }
            .product-source { color: #666; font-size: 14px; }
            .product-image { max-width: 200px; height: auto; border-radius: 4px; margin: 10px 0; }
            .footer { margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px; text-align: center; color: #666; }
            a { color: #3498db; text-decoration: none; }
            a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>🛍️ Product Scraper Report</h2>
            <p><strong>Date:</strong> ${currentDate}</p>
            ${searchTerm ? `<p><strong>Search Term:</strong> "${searchTerm}"</p>` : ''}
            <p><strong>Found:</strong> ${products.length} product(s)</p>
          </div>
    `;

    products.forEach((product, index) => {
      html += `
        <div class="product">
          <div class="product-title">${index + 1}. ${product.title}</div>
          <div class="product-price">$${product.price ? product.price.toFixed(2) : 'N/A'}</div>
          ${product.image ? `<img src="${product.image}" alt="Product Image" class="product-image">` : ''}
          <div class="product-source">Source: ${product.source}</div>
          ${product.rating ? `<div>⭐ Rating: ${product.rating}/5</div>` : ''}
          <div style="margin-top: 10px;">
            <a href="${product.url}" target="_blank">View Product →</a>
          </div>
        </div>
      `;
    });

    html += `
          <div class="footer">
            <p>This report was generated automatically by Product Scraper</p>
            <p><small>Scraped at: ${new Date().toLocaleString()}</small></p>
          </div>
        </body>
      </html>
    `;

    return html;
  }

  async testEmailConnection() {
    if (!this.transporter) {
      throw new Error('Email service not initialized');
    }

    try {
      await this.transporter.verify();
      logger.info('Email connection test successful');
      return true;
    } catch (error) {
      logger.error('Email connection test failed:', error);
      throw error;
    }
  }
}

module.exports = EmailService;