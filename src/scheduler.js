const cron = require('node-cron');
const ProductScraper = require('./scraper');
const EmailService = require('./services/emailService');
const logger = require('./utils/logger');
const config = require('../config/config.json');
require('dotenv').config();

class ScrapingScheduler {
  constructor() {
    this.scraper = new ProductScraper();
    this.emailService = new EmailService();
    this.scheduledTasks = new Map();
  }

  async scheduleScrapingJob(jobName, cronExpression, scrapingConfig) {
    try {
      // Validate cron expression
      if (!cron.validate(cronExpression)) {
        throw new Error(`Invalid cron expression: ${cronExpression}`);
      }

      // Cancel existing job with same name if it exists
      if (this.scheduledTasks.has(jobName)) {
        this.scheduledTasks.get(jobName).destroy();
        logger.info(`Cancelled existing job: ${jobName}`);
      }

      // Schedule new job
      const task = cron.schedule(cronExpression, async () => {
        await this.executeScrapingJob(jobName, scrapingConfig);
      }, {
        scheduled: false
      });

      this.scheduledTasks.set(jobName, task);
      task.start();

      logger.info(`Scheduled job '${jobName}' with expression: ${cronExpression}`);
      return true;

    } catch (error) {
      logger.error(`Failed to schedule job '${jobName}':`, error);
      throw error;
    }
  }

  async executeScrapingJob(jobName, config) {
    try {
      logger.info(`Executing scheduled job: ${jobName}`);

      const { websites, searchTerm, maxResults = 3 } = config;
      let allResults = [];

      // Scrape from multiple websites if configured
      if (websites && Array.isArray(websites)) {
        for (const website of websites) {
          try {
            const results = await this.scraper.scrapeWebsite(website.name, {
              searchTerm: searchTerm || website.searchTerm,
              maxResults: website.maxResults || maxResults
            });
            allResults.push(...results);
          } catch (error) {
            logger.error(`Failed to scrape ${website.name} in job ${jobName}:`, error);
          }
        }
      } else {
        // Default scraping (can be configured)
        const results = await this.scraper.scrapeWebsite('amazon', {
          searchTerm: searchTerm || 'laptop',
          maxResults
        });
        allResults.push(...results);
      }

      // Sort by price and get top products
      const topProducts = allResults
        .filter(product => product.price !== null)
        .sort((a, b) => a.price - b.price)
        .slice(0, 3);

      if (topProducts.length > 0) {
        await this.emailService.sendTopProducts(topProducts, searchTerm);
        logger.info(`Job '${jobName}' completed successfully. Sent ${topProducts.length} products via email.`);
      } else {
        logger.warn(`Job '${jobName}' found no products to send.`);
      }

    } catch (error) {
      logger.error(`Error executing job '${jobName}':`, error);
    }
  }

  stopJob(jobName) {
    if (this.scheduledTasks.has(jobName)) {
      this.scheduledTasks.get(jobName).destroy();
      this.scheduledTasks.delete(jobName);
      logger.info(`Stopped job: ${jobName}`);
      return true;
    }
    return false;
  }

  listActiveJobs() {
    return Array.from(this.scheduledTasks.keys());
  }

  async stopAllJobs() {
    for (const [jobName, task] of this.scheduledTasks) {
      task.destroy();
      logger.info(`Stopped job: ${jobName}`);
    }
    this.scheduledTasks.clear();

    if (this.scraper) {
      await this.scraper.close();
    }
  }

  // Predefined schedule helpers
  scheduleDaily(jobName, hour = 9, minute = 0, scrapingConfig) {
    return this.scheduleScrapingJob(jobName, `${minute} ${hour} * * *`, scrapingConfig);
  }

  scheduleWeekly(jobName, dayOfWeek = 1, hour = 9, minute = 0, scrapingConfig) {
    return this.scheduleScrapingJob(jobName, `${minute} ${hour} * * ${dayOfWeek}`, scrapingConfig);
  }

  scheduleHourly(jobName, minute = 0, scrapingConfig) {
    return this.scheduleScrapingJob(jobName, `${minute} * * * *`, scrapingConfig);
  }
}

// Main function to start scheduler from config
async function startFromConfig() {
  try {
    const scheduler = new ScrapingScheduler();

    if (config && config.scheduledJobs) {
      for (const job of config.scheduledJobs) {
        await scheduler.scheduleScrapingJob(job.name, job.schedule, job.config);
      }
    }

    // Graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down scheduler...');
      await scheduler.stopAllJobs();
      process.exit(0);
    });

    logger.info('Scheduler started successfully. Press Ctrl+C to stop.');

    // Keep the process alive
    setInterval(() => {}, 1000);

  } catch (error) {
    logger.error('Failed to start scheduler:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  startFromConfig();
}

module.exports = ScrapingScheduler;