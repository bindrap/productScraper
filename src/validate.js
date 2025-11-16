#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const EmailService = require('./services/emailService');
const logger = require('./utils/logger');
require('dotenv').config();

console.log('\n=================================');
console.log('Product Scraper Validation');
console.log('=================================\n');

let hasErrors = false;

// Check .env file
console.log('Checking configuration...');
const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
  console.error('❌ .env file not found!');
  console.log('   Run: npm run setup\n');
  hasErrors = true;
} else {
  console.log('✓ .env file exists');
}

// Check logs directory
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  console.log('⚠ logs directory not found. Creating...');
  fs.mkdirSync(logsDir);
  console.log('✓ logs directory created');
} else {
  console.log('✓ logs directory exists');
}

// Check required environment variables
const requiredVars = ['EMAIL_USER', 'EMAIL_PASSWORD'];
const missingVars = requiredVars.filter(v => !process.env[v] || process.env[v].includes('your-'));

if (missingVars.length > 0) {
  console.error(`❌ Missing or unconfigured environment variables: ${missingVars.join(', ')}`);
  console.log('   Run: npm run setup\n');
  hasErrors = true;
} else {
  console.log('✓ Required environment variables set');
}

// Test email connection
if (!hasErrors) {
  console.log('\nTesting email connection...');

  (async () => {
    try {
      const emailService = new EmailService();
      await emailService.testEmailConnection();
      console.log('✓ Email connection successful!\n');

      console.log('=================================');
      console.log('All validation checks passed! ✓');
      console.log('=================================\n');
      console.log('You can now:');
      console.log('1. Run a quick scrape: npm start');
      console.log('2. Use the CLI: npm run scrape -- -s "laptop" -e');
      console.log('3. Schedule jobs: npm run schedule');
      console.log('4. See all options: node src/cli.js --help\n');

    } catch (error) {
      console.error('❌ Email connection failed!');
      console.error(`   Error: ${error.message}\n`);
      console.log('Troubleshooting:');
      console.log('1. Make sure you\'re using a Gmail App Password, not your regular password');
      console.log('2. Enable 2-Factor Authentication on your Google account');
      console.log('3. Generate App Password: Google Account > Security > 2-Step Verification > App passwords');
      console.log('4. Check your internet connection\n');
      process.exit(1);
    }
  })();
} else {
  console.log('\n=================================');
  console.log('Validation failed! Please fix the errors above.');
  console.log('=================================\n');
  process.exit(1);
}
