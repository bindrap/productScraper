#!/usr/bin/env node

const { program } = require('commander');
const ProductScraper = require('./scraper');
const EmailService = require('./services/emailService');
const ScrapingScheduler = require('./scheduler');
const logger = require('./utils/logger');
require('dotenv').config();

program
  .name('product-scraper')
  .description('CLI tool to scrape product information from e-commerce websites')
  .version('1.0.0');

program
  .command('scrape')
  .description('Scrape products from a website')
  .requiredOption('-w, --website <name>', 'Website to scrape (amazon, ebay)')
  .requiredOption('-s, --search <term>', 'Search term')
  .option('-m, --max <number>', 'Maximum number of results', '3')
  .option('-e, --email', 'Send results via email', false)
  .action(async (options) => {
    const scraper = new ProductScraper();

    try {
      logger.info(`Scraping ${options.website} for "${options.search}"...`);

      const results = await scraper.scrapeWebsite(options.website, {
        searchTerm: options.search,
        maxResults: parseInt(options.max)
      });

      console.log(`\nFound ${results.length} products:\n`);
      results.forEach((product, index) => {
        console.log(`${index + 1}. ${product.title}`);
        console.log(`   Price: $${product.price ? product.price.toFixed(2) : 'N/A'}`);
        console.log(`   Source: ${product.source}`);
        if (product.rating) console.log(`   Rating: ${product.rating}/5`);
        console.log(`   URL: ${product.url}\n`);
      });

      if (options.email && results.length > 0) {
        const emailService = new EmailService();
        await emailService.sendTopProducts(results, options.search);
        console.log('Results sent via email!');
      }

    } catch (error) {
      logger.error('Scraping failed:', error);
      console.error(`Error: ${error.message}`);
      process.exit(1);
    } finally {
      await scraper.close();
    }
  });

program
  .command('scrape-all')
  .description('Scrape products from multiple websites')
  .requiredOption('-s, --search <term>', 'Search term')
  .option('-m, --max <number>', 'Maximum results per website', '3')
  .option('-e, --email', 'Send results via email', false)
  .action(async (options) => {
    const scraper = new ProductScraper();

    try {
      logger.info(`Scraping multiple websites for "${options.search}"...`);

      const websites = [
        { name: 'amazon', options: { searchTerm: options.search, maxResults: parseInt(options.max) } },
        { name: 'ebay', options: { searchTerm: options.search, maxResults: parseInt(options.max) } }
      ];

      const results = await scraper.scrapeMultipleWebsites(websites);

      console.log(`\nFound ${results.length} top products across all websites:\n`);
      results.forEach((product, index) => {
        console.log(`${index + 1}. ${product.title}`);
        console.log(`   Price: $${product.price ? product.price.toFixed(2) : 'N/A'}`);
        console.log(`   Source: ${product.source}`);
        if (product.rating) console.log(`   Rating: ${product.rating}/5`);
        console.log(`   URL: ${product.url}\n`);
      });

      if (options.email && results.length > 0) {
        const emailService = new EmailService();
        await emailService.sendTopProducts(results, options.search);
        console.log('Results sent via email!');
      }

    } catch (error) {
      logger.error('Scraping failed:', error);
      console.error(`Error: ${error.message}`);
      process.exit(1);
    } finally {
      await scraper.close();
    }
  });

program
  .command('test-email')
  .description('Test email configuration')
  .action(async () => {
    try {
      const emailService = new EmailService();
      console.log('Testing email connection...');
      await emailService.testEmailConnection();
      console.log('Email configuration is valid!');
    } catch (error) {
      console.error(`Email test failed: ${error.message}`);
      console.log('\nPlease check:');
      console.log('1. EMAIL_USER and EMAIL_PASSWORD in .env');
      console.log('2. Gmail App Password is set up correctly');
      console.log('3. Internet connection is working');
      process.exit(1);
    }
  });

program
  .command('schedule')
  .description('Start the scheduler with jobs from config.json')
  .action(async () => {
    try {
      console.log('Starting scheduler...');
      const scheduler = new ScrapingScheduler();
      const config = require('../config/config.json');

      if (config && config.scheduledJobs) {
        for (const job of config.scheduledJobs) {
          await scheduler.scheduleScrapingJob(job.name, job.schedule, job.config);
          console.log(`Scheduled: ${job.name} (${job.schedule})`);
        }
      }

      console.log('\nScheduler is running. Press Ctrl+C to stop.');

      // Graceful shutdown
      process.on('SIGINT', async () => {
        console.log('\nShutting down scheduler...');
        await scheduler.stopAllJobs();
        process.exit(0);
      });

      // Keep the process alive
      setInterval(() => {}, 1000);

    } catch (error) {
      console.error(`Scheduler failed: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('list-scrapers')
  .description('List available website scrapers')
  .action(() => {
    const scraper = new ProductScraper();
    const available = scraper.scraperRegistry.getAvailableScrapers();
    console.log('\nAvailable website scrapers:');
    available.forEach(name => console.log(`  - ${name}`));
    console.log('');
  });

program.parse();
