#!/usr/bin/env node

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const bodyParser = require('body-parser');
const ScraperDatabase = require('./database');
const ProductScraper = require('../scraper');
const EmailService = require('../services/emailService');
const logger = require('../utils/logger');
const config = require('../../config/config.json');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Initialize database
const db = new ScraperDatabase();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Store active scraping jobs
const activeJobs = new Map();

// ============= API Routes =============

// Get statistics
app.get('/api/stats', (req, res) => {
  try {
    const stats = db.getStatistics();
    res.json(stats);
  } catch (error) {
    logger.error('Error getting stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get recent results
app.get('/api/results', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const results = db.getRecentResults(limit);
    res.json(results);
  } catch (error) {
    logger.error('Error getting results:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get results by search term
app.get('/api/results/search/:term', (req, res) => {
  try {
    const results = db.getResultsBySearchTerm(req.params.term);
    res.json(results);
  } catch (error) {
    logger.error('Error searching results:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get price history
app.get('/api/history/:term', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const history = db.getPriceHistory(req.params.term, days);
    res.json(history);
  } catch (error) {
    logger.error('Error getting price history:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all jobs
app.get('/api/jobs', (req, res) => {
  try {
    const jobs = db.getAllJobs();
    res.json(jobs);
  } catch (error) {
    logger.error('Error getting jobs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get job by ID
app.get('/api/jobs/:jobId', (req, res) => {
  try {
    const job = db.getJobById(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    const results = db.getResultsByJobId(req.params.jobId);
    res.json({ ...job, results });
  } catch (error) {
    logger.error('Error getting job:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create and run new scraping job
app.post('/api/scrape', async (req, res) => {
  try {
    const { searchTerm, websites, maxResults, sendEmail } = req.body;

    if (!searchTerm) {
      return res.status(400).json({ error: 'Search term is required' });
    }

    // Create job in database
    const jobId = db.createJob({
      name: `Scrape: ${searchTerm}`,
      searchTerm,
      websites: websites || ['amazon', 'ebay'],
      maxResults: maxResults || 3
    });

    // Return immediately
    res.json({ jobId, status: 'pending', message: 'Job created successfully' });

    // Run scraping in background
    runScrapingJob(jobId, searchTerm, websites || ['amazon', 'ebay'], maxResults || 3, sendEmail || false);

  } catch (error) {
    logger.error('Error creating scrape job:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get logs
app.get('/api/logs/:type?', (req, res) => {
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
      .slice(-100)  // Last 100 lines
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

async function runScrapingJob(jobId, searchTerm, websites, maxResults, sendEmail) {
  const scraper = new ProductScraper();
  let emailService = null;

  if (sendEmail) {
    emailService = new EmailService();
  }

  try {
    // Update status to running
    db.updateJobStatus(jobId, 'running');
    io.emit('job:status', { jobId, status: 'running' });

    logger.info(`Starting job ${jobId}: ${searchTerm}`);

    const allResults = [];

    // Scrape each website
    for (const websiteName of websites) {
      try {
        io.emit('job:progress', { jobId, message: `Scraping ${websiteName}...` });

        const results = await scraper.scrapeWebsite(websiteName, {
          searchTerm,
          maxResults
        });

        allResults.push(...results);

        // Save results to database
        db.insertResults(results, jobId, searchTerm);

        io.emit('job:results', { jobId, website: websiteName, results });

      } catch (error) {
        logger.error(`Error scraping ${websiteName} for job ${jobId}:`, error);
        io.emit('job:error', { jobId, website: websiteName, error: error.message });
      }
    }

    // Sort by price and get top results
    const topResults = allResults
      .filter(product => product.price !== null)
      .sort((a, b) => a.price - b.price)
      .slice(0, 3);

    // Send email if requested
    if (sendEmail && emailService && topResults.length > 0) {
      try {
        await emailService.sendTopProducts(topResults, searchTerm);
        io.emit('job:progress', { jobId, message: 'Email sent successfully' });
      } catch (emailError) {
        logger.error(`Error sending email for job ${jobId}:`, emailError);
      }
    }

    // Update job status to completed
    db.updateJobStatus(jobId, 'completed');
    io.emit('job:status', { jobId, status: 'completed', results: topResults });

    logger.info(`Job ${jobId} completed successfully with ${allResults.length} results`);

  } catch (error) {
    logger.error(`Job ${jobId} failed:`, error);
    db.updateJobStatus(jobId, 'failed', error.message);
    io.emit('job:status', { jobId, status: 'failed', error: error.message });
  } finally {
    await scraper.close();
  }
}

// ============= Socket.IO Events =============

io.on('connection', (socket) => {
  logger.info('Client connected to websocket');

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
  console.log(`\n🚀 Product Scraper Web Dashboard`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`📡 API: http://localhost:${PORT}/api`);
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
