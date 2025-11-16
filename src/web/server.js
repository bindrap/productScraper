#!/usr/bin/env node

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const ScraperDatabase = require('./database');
const ProductScraper = require('../scraper');
const EmailService = require('../services/emailService');
const { generateToken, authenticate, optionalAuth } = require('./auth');
const logger = require('../utils/logger');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Initialize database
const db = new ScraperDatabase();

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Store active scraping jobs
const activeJobs = new Map();

// ============= Authentication Routes =============

// Register new user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, displayName } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const user = db.createUser(username, email, password, displayName);
    const token = generateToken(user);

    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: 'lax'
    });

    res.json({
      message: 'User registered successfully',
      user: { id: user.id, username: user.username, email: user.email, displayName: user.displayName },
      token
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = db.verifyPassword(username, password);

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = generateToken(user);

    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: 'lax'
    });

    res.json({
      message: 'Login successful',
      user: { id: user.id, username: user.username, email: user.email, displayName: user.displayName },
      token
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

// Get current user
app.get('/api/auth/me', authenticate, (req, res) => {
  try {
    const user = db.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============= Friends Routes =============

// Get friends list
app.get('/api/friends', authenticate, (req, res) => {
  try {
    const friends = db.getFriends(req.user.id);
    res.json(friends);
  } catch (error) {
    logger.error('Get friends error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get pending friend requests
app.get('/api/friends/requests', authenticate, (req, res) => {
  try {
    const requests = db.getPendingFriendRequests(req.user.id);
    res.json(requests);
  } catch (error) {
    logger.error('Get friend requests error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send friend request
app.post('/api/friends/request', authenticate, (req, res) => {
  try {
    const { username } = req.body;
    const result = db.sendFriendRequest(req.user.id, username);
    res.json(result);
  } catch (error) {
    logger.error('Send friend request error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Accept friend request
app.post('/api/friends/accept/:friendId', authenticate, (req, res) => {
  try {
    const friendId = parseInt(req.params.friendId);
    const result = db.acceptFriendRequest(req.user.id, friendId);
    res.json(result);
  } catch (error) {
    logger.error('Accept friend request error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Remove friend
app.delete('/api/friends/:friendId', authenticate, (req, res) => {
  try {
    const friendId = parseInt(req.params.friendId);
    const result = db.removeFriend(req.user.id, friendId);
    res.json(result);
  } catch (error) {
    logger.error('Remove friend error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============= Sharing Routes =============

// Share job with friend
app.post('/api/share', authenticate, (req, res) => {
  try {
    const { friendId, jobId } = req.body;
    const result = db.shareJobWithFriend(req.user.id, friendId, jobId);
    res.json(result);
  } catch (error) {
    logger.error('Share job error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Unshare job
app.delete('/api/share', authenticate, (req, res) => {
  try {
    const { friendId, jobId } = req.query;
    const result = db.unshareJob(req.user.id, parseInt(friendId), jobId);
    res.json(result);
  } catch (error) {
    logger.error('Unshare job error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get jobs shared with me
app.get('/api/share/with-me', authenticate, (req, res) => {
  try {
    const shared = db.getSharedWithMe(req.user.id);
    res.json(shared);
  } catch (error) {
    logger.error('Get shared with me error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get my shares
app.get('/api/share/my-shares', authenticate, (req, res) => {
  try {
    const shares = db.getMyShares(req.user.id);
    res.json(shares);
  } catch (error) {
    logger.error('Get my shares error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============= Protected Scraping Routes =============

// Get statistics (user-specific)
app.get('/api/stats', authenticate, (req, res) => {
  try {
    const stats = db.getStatistics(req.user.id);
    res.json(stats);
  } catch (error) {
    logger.error('Error getting stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get recent results (user-specific)
app.get('/api/results', authenticate, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const results = db.getRecentResults(req.user.id, limit);
    res.json(results);
  } catch (error) {
    logger.error('Error getting results:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get results by search term (user-specific)
app.get('/api/results/search/:term', authenticate, (req, res) => {
  try {
    const results = db.getResultsBySearchTerm(req.params.term, req.user.id);
    res.json(results);
  } catch (error) {
    logger.error('Error searching results:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get price history (user-specific)
app.get('/api/history/:term', authenticate, (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const history = db.getPriceHistory(req.params.term, req.user.id, days);
    res.json(history);
  } catch (error) {
    logger.error('Error getting price history:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all jobs (user-specific)
app.get('/api/jobs', authenticate, (req, res) => {
  try {
    const jobs = db.getAllJobs(req.user.id);
    res.json(jobs);
  } catch (error) {
    logger.error('Error getting jobs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get job by ID (with permission check)
app.get('/api/jobs/:jobId', authenticate, (req, res) => {
  try {
    const job = db.getJobById(req.params.jobId, req.user.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    const results = db.getResultsByJobId(req.params.jobId, req.user.id);
    res.json({ ...job, results });
  } catch (error) {
    logger.error('Error getting job:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete job (user-specific)
app.delete('/api/jobs/:jobId', authenticate, (req, res) => {
  try {
    const jobId = parseInt(req.params.jobId);
    const job = db.getJobByDatabaseId(jobId, req.user.id);

    if (!job) {
      return res.status(404).json({ error: 'Job not found or not authorized' });
    }

    // Delete the job (will cascade delete results)
    db.deleteJob(jobId, req.user.id);
    res.json({ message: 'Job deleted successfully' });
  } catch (error) {
    logger.error('Error deleting job:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get results for a specific job (user-specific)
app.get('/api/jobs/:jobId/results', authenticate, (req, res) => {
  try {
    const jobId = parseInt(req.params.jobId);
    const job = db.getJobByDatabaseId(jobId, req.user.id);

    if (!job) {
      return res.status(404).json({ error: 'Job not found or not authorized' });
    }

    const results = db.getResultsByDatabaseJobId(jobId, req.user.id);

    // Add CAD conversion (1 USD = 1.35 CAD approximately)
    const resultsWithCAD = results.map(result => ({
      ...result,
      price_cad: result.price ? (result.price * 1.35).toFixed(2) : null
    }));

    res.json(resultsWithCAD);
  } catch (error) {
    logger.error('Error getting job results:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create and run new scraping job (user-specific)
app.post('/api/scrape', authenticate, async (req, res) => {
  try {
    const { searchTerm, websites, maxResults, sendEmail } = req.body;

    if (!searchTerm) {
      return res.status(400).json({ error: 'Search term is required' });
    }

    // Create job in database with user ID
    const jobId = db.createJob({
      name: `Scrape: ${searchTerm}`,
      searchTerm,
      websites: websites || ['amazon', 'ebay'],
      maxResults: maxResults || 3
    }, req.user.id);

    // Return immediately
    res.json({ jobId, status: 'pending', message: 'Job created successfully' });

    // Run scraping in background
    runScrapingJob(jobId, searchTerm, websites || ['amazon', 'ebay'], maxResults || 3, sendEmail || false, req.user.id);

  } catch (error) {
    logger.error('Error creating scrape job:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get logs (admin only for now, can be user-specific later)
app.get('/api/logs/:type?', authenticate, (req, res) => {
  try {
    const type = req.params.type || 'combined';
    const logFile = type === 'error' ? 'error.log' : 'combined.log';
    const logPath = path.join(__dirname, '..', '..', 'logs', logFile);

    if (!fs.existsSync(logPath)) {
      return res.json({ logs: [] });
    }

    const logs = fs.readFileSync(logPath, 'utf8')
      .split('\n')
      .filter(line => line.trim())
      .slice(-100)
      .reverse();

    res.json({ logs });
  } catch (error) {
    logger.error('Error reading logs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get available scrapers
app.get('/api/scrapers', (req, res) => {
  try {
    const scraper = new ProductScraper();
    const scrapers = scraper.scraperRegistry.getAvailableScrapers();
    res.json({ scrapers });
  } catch (error) {
    logger.error('Error getting scrapers:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============= Background Job Runner =============

async function runScrapingJob(jobId, searchTerm, websites, maxResults, sendEmail, userId) {
  const scraper = new ProductScraper();
  let emailService = null;

  if (sendEmail) {
    emailService = new EmailService();
  }

  try {
    db.updateJobStatus(jobId, 'running');
    io.emit('job:status', { jobId, status: 'running', userId });

    logger.info(`Starting job ${jobId} for user ${userId}: ${searchTerm}`);

    const allResults = [];

    for (const websiteName of websites) {
      try {
        io.emit('job:progress', { jobId, message: `Scraping ${websiteName}...`, userId });

        const results = await scraper.scrapeWebsite(websiteName, {
          searchTerm,
          maxResults
        });

        allResults.push(...results);

        // Save results to database with user ID
        db.insertResults(results, jobId, searchTerm, userId);

        io.emit('job:results', { jobId, website: websiteName, results, userId });

      } catch (error) {
        logger.error(`Error scraping ${websiteName} for job ${jobId}:`, error);
        io.emit('job:error', { jobId, website: websiteName, error: error.message, userId });
      }
    }

    const topResults = allResults
      .filter(product => product.price !== null)
      .sort((a, b) => a.price - b.price)
      .slice(0, 3);

    if (sendEmail && emailService && topResults.length > 0) {
      try {
        await emailService.sendTopProducts(topResults, searchTerm);
        io.emit('job:progress', { jobId, message: 'Email sent successfully', userId });
      } catch (emailError) {
        logger.error(`Error sending email for job ${jobId}:`, emailError);
      }
    }

    db.updateJobStatus(jobId, 'completed');
    io.emit('job:status', { jobId, status: 'completed', results: topResults, userId });

    logger.info(`Job ${jobId} completed successfully with ${allResults.length} results`);

  } catch (error) {
    logger.error(`Job ${jobId} failed:`, error);
    db.updateJobStatus(jobId, 'failed', error.message);
    io.emit('job:status', { jobId, status: 'failed', error: error.message, userId });
  } finally {
    await scraper.close();
  }
}

// ============= Socket.IO Events =============

io.on('connection', (socket) => {
  logger.info('Client connected to websocket');

  socket.on('authenticate', (token) => {
    const { verifyToken } = require('./auth');
    const user = verifyToken(token);
    if (user) {
      socket.userId = user.id;
      socket.join(`user:${user.id}`);
      logger.info(`User ${user.id} authenticated via websocket`);
    }
  });

  socket.on('disconnect', () => {
    logger.info('Client disconnected from websocket');
  });

  socket.on('subscribe:job', (jobId) => {
    socket.join(`job:${jobId}`);
    logger.info(`Client subscribed to job ${jobId}`);
  });
});

// ============= Server Startup =============

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  logger.info(`Web dashboard running on http://localhost:${PORT}`);
  console.log(`\n🚀 Product Scraper Web Dashboard (Multi-User)`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`📡 API: http://localhost:${PORT}/api`);
  console.log(`👥 Multi-user with authentication enabled`);
  console.log(`\nPress Ctrl+C to stop the server\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down web server...');
  db.close();
  server.close(() => {
    logger.info('Server shut down successfully');
    process.exit(0);
  });
});

module.exports = { app, server, io, db };
