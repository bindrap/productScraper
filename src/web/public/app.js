// Initialize Socket.io
const socket = io();

// Global state
let currentJobId = null;

// ============= Initialize =============
document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadResults();
    loadJobs();
    setupEventListeners();
    setupSocketListeners();
});

// ============= Event Listeners =============
function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => switchTab(button.dataset.tab));
    });

    // Scrape form submission
    document.getElementById('scrapeForm').addEventListener('submit', handleScrapeSubmit);

    // Search results
    document.getElementById('searchResults').addEventListener('input', (e) => {
        const term = e.target.value;
        if (term) {
            searchResults(term);
        } else {
            loadResults();
        }
    });

    // Refresh logs
    document.getElementById('refreshLogs').addEventListener('click', loadLogs);

    // Log type change
    document.getElementById('logType').addEventListener('change', loadLogs);
}

// ============= Socket.io Listeners =============
function setupSocketListeners() {
    socket.on('connect', () => {
        console.log('Connected to server');
    });

    socket.on('job:status', (data) => {
        if (data.jobId === currentJobId) {
            updateJobStatus(data);
        }
    });

    socket.on('job:progress', (data) => {
        if (data.jobId === currentJobId) {
            updateProgress(data.message);
        }
    });

    socket.on('job:results', (data) => {
        if (data.jobId === currentJobId) {
            displayLiveResults(data.results);
        }
    });

    socket.on('job:error', (data) => {
        if (data.jobId === currentJobId) {
            showError(`Error scraping ${data.website}: ${data.error}`);
        }
    });
}

// ============= Tab Switching =============
function switchTab(tabName) {
    // Update buttons
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update panes
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    document.getElementById(`${tabName}-tab`).classList.add('active');

    // Load data for specific tabs
    if (tabName === 'results') loadResults();
    if (tabName === 'jobs') loadJobs();
    if (tabName === 'logs') loadLogs();
}

// ============= Stats =============
async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        const stats = await response.json();

        document.getElementById('totalResults').textContent = stats.totalResults || 0;
        document.getElementById('totalJobs').textContent = stats.totalJobs || 0;
        document.getElementById('recentJobs').textContent = stats.recentJobs || 0;
        document.getElementById('avgPrice').textContent = `$${parseFloat(stats.avgPrice || 0).toFixed(2)}`;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// ============= Scrape Form =============
async function handleScrapeSubmit(e) {
    e.preventDefault();

    const searchTerm = document.getElementById('searchTerm').value;
    const maxResults = parseInt(document.getElementById('maxResults').value);
    const sendEmail = document.getElementById('sendEmail').checked;

    const websites = Array.from(document.querySelectorAll('input[name="websites"]:checked'))
        .map(cb => cb.value);

    if (websites.length === 0) {
        showError('Please select at least one website');
        return;
    }

    const scrapeBtn = document.getElementById('scrapeBtn');
    scrapeBtn.disabled = true;
    scrapeBtn.textContent = '⏳ Starting...';

    try {
        const response = await fetch('/api/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ searchTerm, websites, maxResults, sendEmail })
        });

        const data = await response.json();

        if (response.ok) {
            currentJobId = data.jobId;
            socket.emit('subscribe:job', data.jobId);
            showJobStatus(data.jobId);
            updateProgress('Job created, starting scraping...');
        } else {
            showError(data.error || 'Failed to create job');
            scrapeBtn.disabled = false;
            scrapeBtn.textContent = '🔍 Start Scraping';
        }
    } catch (error) {
        showError('Failed to create scrape job: ' + error.message);
        scrapeBtn.disabled = false;
        scrapeBtn.textContent = '🔍 Start Scraping';
    }
}

// ============= Job Status =============
function showJobStatus(jobId) {
    const statusDiv = document.getElementById('jobStatus');
    statusDiv.classList.remove('hidden');
    document.getElementById('currentJobId').textContent = jobId;
    document.getElementById('currentStatus').textContent = 'PENDING';
    document.getElementById('currentStatus').className = 'badge pending';
    document.getElementById('currentProgress').textContent = 'Initializing...';
    document.getElementById('liveResults').innerHTML = '';
}

function updateJobStatus(data) {
    const statusSpan = document.getElementById('currentStatus');
    statusSpan.textContent = data.status.toUpperCase();
    statusSpan.className = `badge ${data.status}`;

    if (data.status === 'completed') {
        updateProgress('Job completed successfully!');
        resetScrapeButton();
        loadStats(); // Refresh stats
        if (data.results && data.results.length > 0) {
            displayLiveResults(data.results);
        }
    } else if (data.status === 'failed') {
        updateProgress(`Job failed: ${data.error}`);
        resetScrapeButton();
    }
}

function updateProgress(message) {
    document.getElementById('currentProgress').textContent = message;
}

function displayLiveResults(results) {
    const container = document.getElementById('liveResults');

    results.forEach(result => {
        const productDiv = createProductElement(result);
        container.appendChild(productDiv);
    });
}

function resetScrapeButton() {
    const scrapeBtn = document.getElementById('scrapeBtn');
    scrapeBtn.disabled = false;
    scrapeBtn.textContent = '🔍 Start Scraping';
}

// ============= Results =============
async function loadResults() {
    const container = document.getElementById('resultsContainer');
    container.innerHTML = '<p class="loading">Loading results...</p>';

    try {
        const response = await fetch('/api/results?limit=50');
        const results = await response.json();

        if (results.length === 0) {
            container.innerHTML = '<p class="loading">No results yet. Start a scraping job!</p>';
            return;
        }

        container.innerHTML = '';
        results.forEach(result => {
            container.appendChild(createProductElement(result));
        });
    } catch (error) {
        container.innerHTML = '<p class="loading">Error loading results</p>';
        console.error('Error loading results:', error);
    }
}

async function searchResults(term) {
    const container = document.getElementById('resultsContainer');
    container.innerHTML = '<p class="loading">Searching...</p>';

    try {
        const response = await fetch(`/api/results/search/${encodeURIComponent(term)}`);
        const results = await response.json();

        if (results.length === 0) {
            container.innerHTML = '<p class="loading">No results found</p>';
            return;
        }

        container.innerHTML = '';
        results.forEach(result => {
            container.appendChild(createProductElement(result));
        });
    } catch (error) {
        container.innerHTML = '<p class="loading">Error searching results</p>';
        console.error('Error searching results:', error);
    }
}

function createProductElement(product) {
    const div = document.createElement('div');
    div.className = 'product-item';

    const img = product.image
        ? `<img src="${product.image}" alt="${product.title}" onerror="this.style.display='none'">`
        : '';

    div.innerHTML = `
        ${img}
        <div class="product-info">
            <h4>${product.title}</h4>
            <div class="product-price">$${(product.price || 0).toFixed(2)}</div>
            <div class="product-source">Source: ${product.website || product.source}</div>
            ${product.rating ? `<div>⭐ ${product.rating}/5</div>` : ''}
            ${product.url ? `<a href="${product.url}" target="_blank" class="product-link">View Product →</a>` : ''}
        </div>
    `;

    return div;
}

// ============= Jobs =============
async function loadJobs() {
    const container = document.getElementById('jobsContainer');
    container.innerHTML = '<p class="loading">Loading jobs...</p>';

    try {
        const response = await fetch('/api/jobs');
        const jobs = await response.json();

        if (jobs.length === 0) {
            container.innerHTML = '<p class="loading">No jobs yet</p>';
            return;
        }

        container.innerHTML = '';
        jobs.forEach(job => {
            container.appendChild(createJobElement(job));
        });
    } catch (error) {
        container.innerHTML = '<p class="loading">Error loading jobs</p>';
        console.error('Error loading jobs:', error);
    }
}

function createJobElement(job) {
    const div = document.createElement('div');
    div.className = 'job-card';

    const createdAt = new Date(job.created_at).toLocaleString();
    const websites = JSON.parse(job.websites || '[]').join(', ');

    div.innerHTML = `
        <div class="job-header">
            <div class="job-title">${job.name}</div>
            <span class="badge ${job.status}">${job.status}</span>
        </div>
        <div class="job-details">
            <p><strong>Search:</strong> ${job.search_term}</p>
            <p><strong>Websites:</strong> ${websites}</p>
            <p><strong>Created:</strong> ${createdAt}</p>
            ${job.error ? `<p style="color: var(--danger);"><strong>Error:</strong> ${job.error}</p>` : ''}
        </div>
    `;

    return div;
}

// ============= Logs =============
async function loadLogs() {
    const container = document.getElementById('logsContent');
    const logType = document.getElementById('logType').value;

    container.textContent = 'Loading logs...';

    try {
        const response = await fetch(`/api/logs/${logType}`);
        const data = await response.json();

        if (data.logs.length === 0) {
            container.textContent = 'No logs available';
            return;
        }

        container.textContent = data.logs.join('\n');
    } catch (error) {
        container.textContent = 'Error loading logs';
        console.error('Error loading logs:', error);
    }
}

// ============= Utilities =============
function showError(message) {
    alert('Error: ' + message);
}

// Auto-refresh stats every 30 seconds
setInterval(loadStats, 30000);
