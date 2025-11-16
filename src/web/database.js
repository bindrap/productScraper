const Database = require('better-sqlite3');
const path = require('path');
const logger = require('../utils/logger');

class ScraperDatabase {
  constructor() {
    const dbPath = path.join(__dirname, '..', '..', 'data', 'scraper.db');
    this.db = new Database(dbPath);
    this.initializeTables();
    logger.info('Database initialized');
  }

  initializeTables() {
    // Scraping results table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS scraping_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id TEXT,
        search_term TEXT NOT NULL,
        website TEXT NOT NULL,
        title TEXT NOT NULL,
        price REAL,
        url TEXT,
        image TEXT,
        rating REAL,
        scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Jobs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS scraping_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        search_term TEXT NOT NULL,
        websites TEXT NOT NULL,
        max_results INTEGER DEFAULT 3,
        status TEXT DEFAULT 'pending',
        started_at DATETIME,
        completed_at DATETIME,
        error TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_results_job_id ON scraping_results(job_id);
      CREATE INDEX IF NOT EXISTS idx_results_search_term ON scraping_results(search_term);
      CREATE INDEX IF NOT EXISTS idx_results_scraped_at ON scraping_results(scraped_at);
      CREATE INDEX IF NOT EXISTS idx_jobs_job_id ON scraping_jobs(job_id);
      CREATE INDEX IF NOT EXISTS idx_jobs_status ON scraping_jobs(status);
    `);
  }

  // Insert a scraping result
  insertResult(result, jobId = null, searchTerm = '') {
    const stmt = this.db.prepare(`
      INSERT INTO scraping_results
        (job_id, search_term, website, title, price, url, image, rating, scraped_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    return stmt.run(
      jobId,
      searchTerm,
      result.source || '',
      result.title || '',
      result.price || null,
      result.url || '',
      result.image || '',
      result.rating || null,
      result.scrapedAt || new Date().toISOString()
    );
  }

  // Insert multiple results
  insertResults(results, jobId = null, searchTerm = '') {
    const insertMany = this.db.transaction((results) => {
      for (const result of results) {
        this.insertResult(result, jobId, searchTerm);
      }
    });

    insertMany(results);
  }

  // Create a new job
  createJob(jobData) {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const stmt = this.db.prepare(`
      INSERT INTO scraping_jobs
        (job_id, name, search_term, websites, max_results, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      jobId,
      jobData.name || `Job ${jobId}`,
      jobData.searchTerm || '',
      JSON.stringify(jobData.websites || []),
      jobData.maxResults || 3,
      'pending'
    );

    return jobId;
  }

  // Update job status
  updateJobStatus(jobId, status, error = null) {
    const stmt = this.db.prepare(`
      UPDATE scraping_jobs
      SET status = ?,
          error = ?,
          ${status === 'running' ? 'started_at = CURRENT_TIMESTAMP,' : ''}
          ${status === 'completed' || status === 'failed' ? 'completed_at = CURRENT_TIMESTAMP,' : ''}
          id = id
      WHERE job_id = ?
    `);

    return stmt.run(status, error, jobId);
  }

  // Get recent results
  getRecentResults(limit = 50) {
    const stmt = this.db.prepare(`
      SELECT * FROM scraping_results
      ORDER BY scraped_at DESC
      LIMIT ?
    `);

    return stmt.all(limit);
  }

  // Get results by job ID
  getResultsByJobId(jobId) {
    const stmt = this.db.prepare(`
      SELECT * FROM scraping_results
      WHERE job_id = ?
      ORDER BY price ASC
    `);

    return stmt.all(jobId);
  }

  // Get results by search term
  getResultsBySearchTerm(searchTerm, limit = 50) {
    const stmt = this.db.prepare(`
      SELECT * FROM scraping_results
      WHERE search_term LIKE ?
      ORDER BY scraped_at DESC
      LIMIT ?
    `);

    return stmt.all(`%${searchTerm}%`, limit);
  }

  // Get all jobs
  getAllJobs(limit = 50) {
    const stmt = this.db.prepare(`
      SELECT * FROM scraping_jobs
      ORDER BY created_at DESC
      LIMIT ?
    `);

    return stmt.all(limit);
  }

  // Get job by ID
  getJobById(jobId) {
    const stmt = this.db.prepare(`
      SELECT * FROM scraping_jobs
      WHERE job_id = ?
    `);

    return stmt.get(jobId);
  }

  // Get jobs by status
  getJobsByStatus(status) {
    const stmt = this.db.prepare(`
      SELECT * FROM scraping_jobs
      WHERE status = ?
      ORDER BY created_at DESC
    `);

    return stmt.all(status);
  }

  // Get statistics
  getStatistics() {
    const totalResults = this.db.prepare('SELECT COUNT(*) as count FROM scraping_results').get();
    const totalJobs = this.db.prepare('SELECT COUNT(*) as count FROM scraping_jobs').get();
    const recentJobs = this.db.prepare(`
      SELECT COUNT(*) as count FROM scraping_jobs
      WHERE created_at > datetime('now', '-24 hours')
    `).get();
    const avgPrice = this.db.prepare(`
      SELECT AVG(price) as avg FROM scraping_results
      WHERE price IS NOT NULL
    `).get();

    return {
      totalResults: totalResults.count,
      totalJobs: totalJobs.count,
      recentJobs: recentJobs.count,
      avgPrice: avgPrice.avg ? avgPrice.avg.toFixed(2) : 0
    };
  }

  // Get price history for a search term
  getPriceHistory(searchTerm, days = 30) {
    const stmt = this.db.prepare(`
      SELECT
        DATE(scraped_at) as date,
        AVG(price) as avg_price,
        MIN(price) as min_price,
        MAX(price) as max_price,
        COUNT(*) as count
      FROM scraping_results
      WHERE search_term LIKE ?
        AND price IS NOT NULL
        AND scraped_at > datetime('now', '-${days} days')
      GROUP BY DATE(scraped_at)
      ORDER BY date ASC
    `);

    return stmt.all(`%${searchTerm}%`);
  }

  // Delete old results
  cleanOldResults(days = 90) {
    const stmt = this.db.prepare(`
      DELETE FROM scraping_results
      WHERE scraped_at < datetime('now', '-${days} days')
    `);

    const result = stmt.run();
    logger.info(`Cleaned ${result.changes} old results`);
    return result.changes;
  }

  // Close database
  close() {
    this.db.close();
    logger.info('Database closed');
  }
}

module.exports = ScraperDatabase;
