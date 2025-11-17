const cron = require('node-cron');
const logger = require('../utils/logger');

class JobScheduler {
  constructor(db, runScrapingJobFn) {
    this.db = db;
    this.runScrapingJobFn = runScrapingJobFn;
    this.cronJob = null;
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) {
      logger.warn('Job scheduler is already running');
      return;
    }

    logger.info('🕒 Starting job scheduler...');

    // Check for scheduled jobs every minute
    this.cronJob = cron.schedule('* * * * *', async () => {
      try {
        await this.checkAndRunScheduledJobs();
      } catch (error) {
        logger.error('Error in scheduled job check:', error);
      }
    });

    this.isRunning = true;
    logger.info('✅ Job scheduler started - checking for jobs every minute');
  }

  async checkAndRunScheduledJobs() {
    const activeJobs = this.db.getActiveScheduledJobs();

    if (activeJobs.length === 0) {
      return;
    }

    logger.info(`📋 Found ${activeJobs.length} scheduled job(s) to run`);

    for (const scheduledJob of activeJobs) {
      try {
        await this.executeScheduledJob(scheduledJob);
      } catch (error) {
        logger.error(`Failed to execute scheduled job ${scheduledJob.id}:`, error);
      }
    }
  }

  async executeScheduledJob(scheduledJob) {
    logger.info(`⚙️  Executing scheduled job ${scheduledJob.id}: "${scheduledJob.name}"`);

    try {
      // Create a regular scraping job
      const jobId = this.db.createJob({
        name: `[Scheduled] ${scheduledJob.name}`,
        searchTerm: scheduledJob.search_term,
        websites: scheduledJob.websites,
        maxResults: scheduledJob.max_results
      }, scheduledJob.user_id);

      // Run the scraping job
      await this.runScrapingJobFn(
        jobId,
        scheduledJob.search_term,
        scheduledJob.websites,
        scheduledJob.max_results,
        scheduledJob.send_email,
        scheduledJob.user_id
      );

      // Update last_run and next_run
      this.db.updateScheduledJobNextRun(scheduledJob.id);

      logger.info(`✅ Completed scheduled job ${scheduledJob.id}`);
    } catch (error) {
      logger.error(`❌ Error executing scheduled job ${scheduledJob.id}:`, error);
      throw error;
    }
  }

  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.isRunning = false;
      logger.info('🛑 Job scheduler stopped');
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      activeScheduledJobs: this.db.getActiveScheduledJobs().length
    };
  }
}

module.exports = JobScheduler;
