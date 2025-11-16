#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function setup() {
  console.log('\n=================================');
  console.log('Product Scraper Setup Wizard');
  console.log('=================================\n');

  // Check if .env already exists
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const overwrite = await question('.env file already exists. Overwrite? (y/n): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('Setup cancelled.');
      rl.close();
      return;
    }
  }

  console.log('\nEmail Configuration');
  console.log('-------------------');
  console.log('To use Gmail, you need an App Password.');
  console.log('Learn more: https://support.google.com/accounts/answer/185833\n');

  const emailUser = await question('Gmail address: ');
  const emailPassword = await question('Gmail App Password: ');
  const emailRecipient = await question('Recipient email (press Enter for same): ') || emailUser;

  console.log('\nScraping Settings');
  console.log('-----------------');
  const headless = await question('Run browser in headless mode? (y/n) [y]: ') || 'y';
  const logLevel = await question('Log level (error/warn/info/debug) [info]: ') || 'info';

  // Create .env file
  const envContent = `# Email Configuration
EMAIL_SERVICE=gmail
EMAIL_USER=${emailUser}
EMAIL_PASSWORD=${emailPassword}
EMAIL_RECIPIENT=${emailRecipient}

# Logging
LOG_LEVEL=${logLevel}
NODE_ENV=development

# Scraping Settings
HEADLESS_BROWSER=${headless.toLowerCase() === 'y' ? 'true' : 'false'}
BROWSER_TIMEOUT=30000

# Rate Limiting & Retry Settings
REQUEST_DELAY=1000
MAX_CONCURRENT_REQUESTS=3
MAX_RETRY_ATTEMPTS=3
RETRY_DELAY=2000
`;

  fs.writeFileSync(envPath, envContent);
  console.log('\n.env file created successfully!\n');

  // Create logs directory
  const logsDir = path.join(__dirname, '..', 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
    console.log('logs directory created.\n');
  }

  console.log('Setup complete! Next steps:');
  console.log('1. Test email: npm run validate');
  console.log('2. Run a scrape: npm start');
  console.log('3. Use CLI: npm run scrape -- -s "laptop" -e\n');

  rl.close();
}

setup().catch(error => {
  console.error('Setup failed:', error);
  rl.close();
  process.exit(1);
});
