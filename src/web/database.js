const Database = require('better-sqlite3');
const path = require('path');
const logger = require('../utils/logger');
const bcrypt = require('bcrypt');

class ScraperDatabase {
  constructor() {
    const dbPath = path.join(__dirname, '..', '..', 'data', 'scraper.db');
    this.db = new Database(dbPath);
    this.initializeTables();
    logger.info('Database initialized');
  }

  initializeTables() {
    // Users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        display_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
      )
    `);

    // Friends table (many-to-many relationship)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS friends (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        friend_id INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, friend_id)
      )
    `);

    // Shared searches table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS shared_searches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_id INTEGER NOT NULL,
        shared_with_id INTEGER NOT NULL,
        job_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (shared_with_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Check if user_id column exists in scraping_results
    const resultsColumns = this.db.prepare("PRAGMA table_info(scraping_results)").all();
    const hasUserIdInResults = resultsColumns.some(col => col.name === 'user_id');

    if (!hasUserIdInResults) {
      // Create new table with user_id
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS scraping_results_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          job_id TEXT,
          search_term TEXT NOT NULL,
          website TEXT NOT NULL,
          title TEXT NOT NULL,
          price REAL,
          url TEXT,
          image TEXT,
          rating REAL,
          scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
      `);

      // Copy data if old table exists
      const tableExists = this.db.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='scraping_results'
      `).get();

      if (tableExists) {
        this.db.exec(`
          INSERT INTO scraping_results_new (id, job_id, search_term, website, title, price, url, image, rating, scraped_at, created_at)
          SELECT id, job_id, search_term, website, title, price, url, image, rating, scraped_at, created_at
          FROM scraping_results
        `);
        this.db.exec('DROP TABLE scraping_results');
      }

      this.db.exec('ALTER TABLE scraping_results_new RENAME TO scraping_results');
    } else {
      // Table already has user_id, just ensure it exists
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS scraping_results (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          job_id TEXT,
          search_term TEXT NOT NULL,
          website TEXT NOT NULL,
          title TEXT NOT NULL,
          price REAL,
          url TEXT,
          image TEXT,
          rating REAL,
          scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
      `);
    }

    // Check if user_id exists in scraping_jobs
    const jobsColumns = this.db.prepare("PRAGMA table_info(scraping_jobs)").all();
    const hasUserIdInJobs = jobsColumns.some(col => col.name === 'user_id');

    if (!hasUserIdInJobs) {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS scraping_jobs_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          job_id TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          search_term TEXT NOT NULL,
          websites TEXT NOT NULL,
          max_results INTEGER DEFAULT 3,
          status TEXT DEFAULT 'pending',
          started_at DATETIME,
          completed_at DATETIME,
          error TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      const jobTableExists = this.db.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='scraping_jobs'
      `).get();

      if (jobTableExists) {
        this.db.exec(`
          INSERT INTO scraping_jobs_new (id, job_id, name, search_term, websites, max_results, status, started_at, completed_at, error, created_at)
          SELECT id, job_id, name, search_term, websites, max_results, status, started_at, completed_at, error, created_at
          FROM scraping_jobs
        `);
        this.db.exec('DROP TABLE scraping_jobs');
      }

      this.db.exec('ALTER TABLE scraping_jobs_new RENAME TO scraping_jobs');
    } else {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS scraping_jobs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          job_id TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          search_term TEXT NOT NULL,
          websites TEXT NOT NULL,
          max_results INTEGER DEFAULT 3,
          status TEXT DEFAULT 'pending',
          started_at DATETIME,
          completed_at DATETIME,
          error TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
    }

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_results_user_id ON scraping_results(user_id);
      CREATE INDEX IF NOT EXISTS idx_results_job_id ON scraping_results(job_id);
      CREATE INDEX IF NOT EXISTS idx_results_search_term ON scraping_results(search_term);
      CREATE INDEX IF NOT EXISTS idx_results_scraped_at ON scraping_results(scraped_at);
      CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON scraping_jobs(user_id);
      CREATE INDEX IF NOT EXISTS idx_jobs_job_id ON scraping_jobs(job_id);
      CREATE INDEX IF NOT EXISTS idx_jobs_status ON scraping_jobs(status);
      CREATE INDEX IF NOT EXISTS idx_friends_user_id ON friends(user_id);
      CREATE INDEX IF NOT EXISTS idx_friends_friend_id ON friends(friend_id);
      CREATE INDEX IF NOT EXISTS idx_friends_status ON friends(status);
      CREATE INDEX IF NOT EXISTS idx_shared_owner ON shared_searches(owner_id);
      CREATE INDEX IF NOT EXISTS idx_shared_with ON shared_searches(shared_with_id);
    `);
  }

  // ============= User Management =============

  createUser(username, email, password, displayName = null) {
    const passwordHash = bcrypt.hashSync(password, 10);

    const stmt = this.db.prepare(`
      INSERT INTO users (username, email, password_hash, display_name)
      VALUES (?, ?, ?, ?)
    `);

    try {
      const result = stmt.run(username, email, passwordHash, displayName || username);
      return { id: result.lastInsertRowid, username, email, displayName: displayName || username };
    } catch (error) {
      if (error.message.includes('UNIQUE')) {
        throw new Error('Username or email already exists');
      }
      throw error;
    }
  }

  getUserByUsername(username) {
    const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username);
  }

  getUserByEmail(email) {
    const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email);
  }

  getUserById(id) {
    const stmt = this.db.prepare('SELECT id, username, email, display_name, created_at, last_login FROM users WHERE id = ?');
    return stmt.get(id);
  }

  verifyPassword(username, password) {
    const user = this.getUserByUsername(username);
    if (!user) return null;

    const isValid = bcrypt.compareSync(password, user.password_hash);
    if (!isValid) return null;

    // Update last login
    this.db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

    return { id: user.id, username: user.username, email: user.email, displayName: user.display_name };
  }

  // ============= Friends Management =============

  sendFriendRequest(userId, friendUsername) {
    const friend = this.getUserByUsername(friendUsername);
    if (!friend) {
      throw new Error('User not found');
    }

    if (userId === friend.id) {
      throw new Error('Cannot add yourself as a friend');
    }

    // Check if already friends or request exists
    const existing = this.db.prepare(`
      SELECT * FROM friends
      WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
    `).get(userId, friend.id, friend.id, userId);

    if (existing) {
      if (existing.status === 'accepted') {
        throw new Error('Already friends');
      }
      throw new Error('Friend request already sent');
    }

    const stmt = this.db.prepare(`
      INSERT INTO friends (user_id, friend_id, status)
      VALUES (?, ?, 'pending')
    `);

    stmt.run(userId, friend.id);
    return { message: 'Friend request sent', friend: { id: friend.id, username: friend.username } };
  }

  acceptFriendRequest(userId, friendId) {
    // Update the friend request to accepted
    const stmt = this.db.prepare(`
      UPDATE friends
      SET status = 'accepted'
      WHERE friend_id = ? AND user_id = ? AND status = 'pending'
    `);

    const result = stmt.run(userId, friendId);

    if (result.changes === 0) {
      throw new Error('Friend request not found');
    }

    // Create reciprocal friendship
    const reciprocal = this.db.prepare(`
      INSERT OR IGNORE INTO friends (user_id, friend_id, status)
      VALUES (?, ?, 'accepted')
    `);

    reciprocal.run(userId, friendId);

    return { message: 'Friend request accepted' };
  }

  removeFriend(userId, friendId) {
    const stmt = this.db.prepare(`
      DELETE FROM friends
      WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
    `);

    stmt.run(userId, friendId, friendId, userId);
    return { message: 'Friend removed' };
  }

  getFriends(userId) {
    const stmt = this.db.prepare(`
      SELECT u.id, u.username, u.display_name, u.email, f.status, f.created_at
      FROM friends f
      JOIN users u ON u.id = f.friend_id
      WHERE f.user_id = ? AND f.status = 'accepted'
    `);

    return stmt.all(userId);
  }

  getPendingFriendRequests(userId) {
    // Requests sent TO this user
    const stmt = this.db.prepare(`
      SELECT u.id, u.username, u.display_name, f.created_at
      FROM friends f
      JOIN users u ON u.id = f.user_id
      WHERE f.friend_id = ? AND f.status = 'pending'
    `);

    return stmt.all(userId);
  }

  // ============= Sharing Management =============

  shareJobWithFriend(ownerId, friendId, jobId) {
    // Verify they are friends
    const areFriends = this.db.prepare(`
      SELECT * FROM friends
      WHERE user_id = ? AND friend_id = ? AND status = 'accepted'
    `).get(ownerId, friendId);

    if (!areFriends) {
      throw new Error('Can only share with friends');
    }

    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO shared_searches (owner_id, shared_with_id, job_id)
      VALUES (?, ?, ?)
    `);

    stmt.run(ownerId, friendId, jobId);
    return { message: 'Search shared successfully' };
  }

  unshareJob(ownerId, friendId, jobId) {
    const stmt = this.db.prepare(`
      DELETE FROM shared_searches
      WHERE owner_id = ? AND shared_with_id = ? AND job_id = ?
    `);

    stmt.run(ownerId, friendId, jobId);
    return { message: 'Share removed' };
  }

  getSharedWithMe(userId) {
    const stmt = this.db.prepare(`
      SELECT ss.*, j.*, u.username as owner_username, u.display_name as owner_display_name
      FROM shared_searches ss
      JOIN scraping_jobs j ON j.id = ss.job_id
      JOIN users u ON u.id = ss.owner_id
      WHERE ss.shared_with_id = ?
      ORDER BY ss.created_at DESC
    `);

    return stmt.all(userId);
  }

  getMyShares(userId) {
    const stmt = this.db.prepare(`
      SELECT ss.*, u.username as shared_with_username, u.display_name as shared_with_display_name
      FROM shared_searches ss
      JOIN users u ON u.id = ss.shared_with_id
      WHERE ss.owner_id = ?
      ORDER BY ss.created_at DESC
    `);

    return stmt.all(userId);
  }

  // ============= Scraping Results (User-specific) =============

  insertResult(result, jobId = null, searchTerm = '', userId = null) {
    const stmt = this.db.prepare(`
      INSERT INTO scraping_results
        (user_id, job_id, search_term, website, title, price, url, image, rating, scraped_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    return stmt.run(
      userId,
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

  insertResults(results, jobId = null, searchTerm = '', userId = null) {
    const insertMany = this.db.transaction((results) => {
      for (const result of results) {
        this.insertResult(result, jobId, searchTerm, userId);
      }
    });

    insertMany(results);
  }

  createJob(jobData, userId = null) {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const stmt = this.db.prepare(`
      INSERT INTO scraping_jobs
        (user_id, job_id, name, search_term, websites, max_results, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      userId,
      jobId,
      jobData.name || `Job ${jobId}`,
      jobData.searchTerm || '',
      JSON.stringify(jobData.websites || []),
      jobData.maxResults || 3,
      'pending'
    );

    return jobId;
  }

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

  getRecentResults(userId, limit = 50) {
    const stmt = this.db.prepare(`
      SELECT * FROM scraping_results
      WHERE user_id = ?
      ORDER BY scraped_at DESC
      LIMIT ?
    `);

    return stmt.all(userId, limit);
  }

  getResultsByJobId(jobId, userId = null) {
    // Check if user owns this job or it's shared with them
    if (userId) {
      const job = this.db.prepare('SELECT user_id FROM scraping_jobs WHERE job_id = ?').get(jobId);
      const isShared = this.db.prepare(`
        SELECT * FROM shared_searches WHERE job_id = ? AND shared_with_id = ?
      `).get(jobId, userId);

      if (!job || (job.user_id !== userId && !isShared)) {
        throw new Error('Access denied');
      }
    }

    const stmt = this.db.prepare(`
      SELECT * FROM scraping_results
      WHERE job_id = ?
      ORDER BY price ASC
    `);

    return stmt.all(jobId);
  }

  getResultsBySearchTerm(searchTerm, userId, limit = 50) {
    const stmt = this.db.prepare(`
      SELECT * FROM scraping_results
      WHERE user_id = ? AND search_term LIKE ?
      ORDER BY scraped_at DESC
      LIMIT ?
    `);

    return stmt.all(userId, `%${searchTerm}%`, limit);
  }

  getAllJobs(userId, limit = 50) {
    const stmt = this.db.prepare(`
      SELECT * FROM scraping_jobs
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);

    return stmt.all(userId, limit);
  }

  getJobById(jobId, userId = null) {
    const stmt = this.db.prepare('SELECT * FROM scraping_jobs WHERE job_id = ?');
    const job = stmt.get(jobId);

    if (!job) return null;

    // Check access permissions
    if (userId && job.user_id !== userId) {
      const isShared = this.db.prepare(`
        SELECT * FROM shared_searches WHERE job_id = ? AND shared_with_id = ?
      `).get(jobId, userId);

      if (!isShared) {
        throw new Error('Access denied');
      }
    }

    return job;
  }

  getJobsByStatus(status, userId) {
    const stmt = this.db.prepare(`
      SELECT * FROM scraping_jobs
      WHERE user_id = ? AND status = ?
      ORDER BY created_at DESC
    `);

    return stmt.all(userId, status);
  }

  getStatistics(userId) {
    const totalResults = this.db.prepare('SELECT COUNT(*) as count FROM scraping_results WHERE user_id = ?').get(userId);
    const totalJobs = this.db.prepare('SELECT COUNT(*) as count FROM scraping_jobs WHERE user_id = ?').get(userId);
    const recentJobs = this.db.prepare(`
      SELECT COUNT(*) as count FROM scraping_jobs
      WHERE user_id = ? AND created_at > datetime('now', '-24 hours')
    `).get(userId);
    const avgPrice = this.db.prepare(`
      SELECT AVG(price) as avg FROM scraping_results
      WHERE user_id = ? AND price IS NOT NULL
    `).get(userId);

    return {
      totalResults: totalResults.count,
      totalJobs: totalJobs.count,
      recentJobs: recentJobs.count,
      avgPrice: avgPrice.avg ? avgPrice.avg.toFixed(2) : 0
    };
  }

  getPriceHistory(searchTerm, userId, days = 30) {
    const stmt = this.db.prepare(`
      SELECT
        DATE(scraped_at) as date,
        AVG(price) as avg_price,
        MIN(price) as min_price,
        MAX(price) as max_price,
        COUNT(*) as count
      FROM scraping_results
      WHERE user_id = ? AND search_term LIKE ?
        AND price IS NOT NULL
        AND scraped_at > datetime('now', '-${days} days')
      GROUP BY DATE(scraped_at)
      ORDER BY date ASC
    `);

    return stmt.all(userId, `%${searchTerm}%`);
  }

  cleanOldResults(days = 90) {
    const stmt = this.db.prepare(`
      DELETE FROM scraping_results
      WHERE scraped_at < datetime('now', '-${days} days')
    `);

    const result = stmt.run();
    logger.info(`Cleaned ${result.changes} old results`);
    return result.changes;
  }

  close() {
    this.db.close();
    logger.info('Database closed');
  }
}

module.exports = ScraperDatabase;
