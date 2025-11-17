// ==========================================
// Product Scraper - Multi-User Dashboard
// ==========================================

// Authentication State
let currentUser = null;
let authToken = null;
let socket = null;
let currentJobId = null;

// ==========================================
// Helper Functions
// ==========================================

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

function setCookie(name, value, days) {
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`;
}

function deleteCookie(name) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

async function apiCall(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
    credentials: 'include'
  });

  if (response.status === 401) {
    logout();
    throw new Error('Authentication required');
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

function showError(message) {
  alert(`Error: ${message}`);
}

function showSuccess(message) {
  alert(message);
}

// ==========================================
// Authentication Functions
// ==========================================

async function register(username, email, password, displayName) {
  try {
    const data = await apiCall('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password, displayName })
    });

    authToken = data.token;
    currentUser = data.user;

    onAuthSuccess();
  } catch (error) {
    showError(error.message);
  }
}

async function login(username, password) {
  try {
    const data = await apiCall('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });

    authToken = data.token;
    currentUser = data.user;

    onAuthSuccess();
  } catch (error) {
    showError(error.message);
  }
}

async function logout() {
  try {
    await apiCall('/api/auth/logout', { method: 'POST' });
  } catch (error) {
    // Ignore logout errors
  }

  authToken = null;
  currentUser = null;
  deleteCookie('token');

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  showAuthScreen();
}

async function checkAuth() {
  authToken = getCookie('token');

  if (!authToken) {
    showAuthScreen();
    return;
  }

  try {
    const data = await apiCall('/api/auth/me');
    currentUser = data.user;
    onAuthSuccess();
  } catch (error) {
    showAuthScreen();
  }
}

function onAuthSuccess() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
  document.getElementById('userDisplay').textContent = `👤 ${currentUser.displayName || currentUser.username}`;

  initializeSocket();
  loadDashboard();
}

function showAuthScreen() {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('dashboard').style.display = 'none';
}

// ==========================================
// Socket.IO Setup
// ==========================================

function initializeSocket() {
  socket = io({
    auth: {
      token: authToken
    }
  });

  socket.on('connect', () => {
    console.log('Socket connected');
  });

  socket.on('job:status', (data) => {
    if (data.userId !== currentUser.id) return;

    if (data.jobId === currentJobId) {
      updateJobStatus(data.status, data.progress || '');
    }

    // Refresh stats and jobs when job completes
    if (data.status === 'completed' || data.status === 'failed') {
      loadStats();
      if (document.querySelector('#jobs-tab.tab-pane.active')) {
        loadJobs();
      }
    }
  });

  socket.on('job:results', (data) => {
    if (data.userId !== currentUser.id) return;

    if (data.jobId === currentJobId) {
      displayLiveResults(data.results);
    }
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });
}

// ==========================================
// Dashboard Loading
// ==========================================

async function loadDashboard() {
  await loadStats();

  // Load initial tab content
  const activeTab = document.querySelector('.tab-button.active').dataset.tab;
  loadTabContent(activeTab);
}

async function loadStats() {
  try {
    const stats = await apiCall('/api/stats');

    document.getElementById('totalResults').textContent = stats.totalResults || 0;
    document.getElementById('totalJobs').textContent = stats.totalJobs || 0;
    document.getElementById('recentJobs').textContent = stats.recentJobs || 0;
    document.getElementById('avgPrice').textContent = stats.averagePrice
      ? `$${stats.averagePrice.toFixed(2)}`
      : '$0.00';
  } catch (error) {
    console.error('Failed to load stats:', error);
  }
}

async function loadResults() {
  const container = document.getElementById('resultsContainer');
  container.innerHTML = '<p class="loading">Loading results...</p>';

  try {
    const results = await apiCall('/api/results');

    if (results.length === 0) {
      container.innerHTML = '<p class="empty-state">No results yet. Start a scraping job to see results here.</p>';
      return;
    }

    container.innerHTML = `
      <div class="table-container">
        <table class="products-table">
          <thead>
            <tr>
              <th>Image</th>
              <th>Product Title</th>
              <th>Price (USD)</th>
              <th>Price (CAD)</th>
              <th>Website</th>
              <th>Status</th>
              <th>Rating</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${results.map(result => `
              <tr>
                <td class="product-image-cell">
                  <img src="${result.image_url || '/placeholder.jpg'}" alt="${result.title}" onerror="this.src='/placeholder.jpg'" class="product-thumbnail">
                </td>
                <td class="product-title-cell">${result.title}</td>
                <td class="product-price-cell">$${result.price ? result.price.toFixed(2) : 'N/A'}</td>
                <td class="product-price-cell">${result.price ? '$' + (result.price * 1.35).toFixed(2) : 'N/A'}</td>
                <td class="product-website-cell">${result.website}</td>
                <td class="product-status-cell">${result.in_stock ? '<span class="status-badge in-stock">✅ In Stock</span>' : '<span class="status-badge out-of-stock">❌ Out of Stock</span>'}</td>
                <td class="product-rating-cell">${result.rating ? '⭐ ' + result.rating : '-'}</td>
                <td class="product-action-cell">
                  <a href="${result.url}" target="_blank" class="btn btn-small btn-primary">View</a>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (error) {
    container.innerHTML = '<p class="error">Failed to load results</p>';
  }
}

async function loadJobs() {
  const container = document.getElementById('jobsContainer');
  container.innerHTML = '<p class="loading">Loading jobs...</p>';

  try {
    const jobs = await apiCall('/api/jobs');

    if (jobs.length === 0) {
      container.innerHTML = '<p class="empty-state">No jobs yet.</p>';
      return;
    }

    container.innerHTML = jobs.map(job => `
      <div class="job-card">
        <div class="job-header">
          <h3>Job #${job.id} - ${job.search_term}</h3>
          <span class="badge badge-${job.status}">${job.status}</span>
        </div>
        <div class="job-details">
          <p><strong>Websites:</strong> ${job.websites}</p>
          <p><strong>Created:</strong> ${new Date(job.created_at).toLocaleString()}</p>
          ${job.completed_at ? `<p><strong>Completed:</strong> ${new Date(job.completed_at).toLocaleString()}</p>` : ''}
          ${job.results_count ? `<p><strong>Results:</strong> ${job.results_count} products found</p>` : ''}
        </div>
        <div class="job-actions">
          <button class="btn btn-small" onclick="shareJob(${job.id})">Share with Friend</button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    container.innerHTML = '<p class="error">Failed to load jobs</p>';
  }
}

async function loadFriends() {
  await loadPendingRequests();
  await loadFriendsList();
}

async function loadPendingRequests() {
  const container = document.getElementById('pendingRequests');
  container.innerHTML = '<p class="loading">Loading...</p>';

  try {
    const requests = await apiCall('/api/friends/requests');

    if (requests.length === 0) {
      container.innerHTML = '<p class="empty-state">No pending requests</p>';
      return;
    }

    container.innerHTML = requests.map(req => `
      <div class="friend-request">
        <span><strong>${req.username}</strong> wants to be friends</span>
        <button class="btn btn-small btn-primary" onclick="acceptFriend(${req.id})">Accept</button>
      </div>
    `).join('');
  } catch (error) {
    container.innerHTML = '<p class="error">Failed to load requests</p>';
  }
}

async function loadFriendsList() {
  const container = document.getElementById('friendsList');
  container.innerHTML = '<p class="loading">Loading...</p>';

  try {
    const friends = await apiCall('/api/friends');

    if (friends.length === 0) {
      container.innerHTML = '<p class="empty-state">No friends yet. Add someone!</p>';
      return;
    }

    container.innerHTML = friends.map(friend => `
      <div class="friend-item">
        <span>👤 ${friend.username} (${friend.display_name})</span>
        <button class="btn btn-small btn-danger" onclick="removeFriend(${friend.friend_id})">Remove</button>
      </div>
    `).join('');
  } catch (error) {
    container.innerHTML = '<p class="error">Failed to load friends</p>';
  }
}

async function loadSharedJobs() {
  const container = document.getElementById('sharedContainer');
  container.innerHTML = '<p class="loading">Loading...</p>';

  try {
    const shared = await apiCall('/api/share/with-me');

    if (shared.length === 0) {
      container.innerHTML = '<p class="empty-state">No jobs shared with you yet.</p>';
      return;
    }

    container.innerHTML = shared.map(item => `
      <div class="job-card">
        <div class="job-header">
          <h3>Job #${item.job_id} - ${item.search_term}</h3>
          <span class="badge badge-${item.status}">${item.status}</span>
        </div>
        <div class="job-details">
          <p><strong>Shared by:</strong> ${item.owner_username}</p>
          <p><strong>Websites:</strong> ${item.websites}</p>
          <p><strong>Created:</strong> ${new Date(item.created_at).toLocaleString()}</p>
          ${item.results_count ? `<p><strong>Results:</strong> ${item.results_count} products found</p>` : ''}
        </div>
      </div>
    `).join('');
  } catch (error) {
    container.innerHTML = '<p class="error">Failed to load shared jobs</p>';
  }
}

async function loadLogs() {
  const container = document.getElementById('logsContent');
  const logType = document.getElementById('logType').value;

  container.textContent = 'Loading logs...';

  try {
    const data = await apiCall(`/api/logs/${logType}`);
    container.textContent = data.logs || 'No logs available';
  } catch (error) {
    container.textContent = 'Failed to load logs';
  }
}

// ==========================================
// Tab Management
// ==========================================

function loadTabContent(tabName) {
  switch (tabName) {
    case 'scrape':
      // Already loaded
      break;
    case 'results':
      loadResults();
      break;
    case 'jobs':
      loadJobs();
      break;
    case 'friends':
      loadFriends();
      break;
    case 'shared':
      loadSharedJobs();
      break;
    case 'logs':
      loadLogs();
      break;
  }
}

// ==========================================
// Scraping Functions
// ==========================================

async function startScraping(formData) {
  try {
    const data = await apiCall('/api/scrape', {
      method: 'POST',
      body: JSON.stringify(formData)
    });

    currentJobId = data.jobId;

    document.getElementById('jobStatus').classList.remove('hidden');
    document.getElementById('currentJobId').textContent = data.jobId;
    updateJobStatus('queued', 'Job queued...');

    showSuccess('Scraping job started!');
  } catch (error) {
    showError(error.message);
  }
}

function updateJobStatus(status, progress) {
  const statusEl = document.getElementById('currentStatus');
  statusEl.textContent = status;
  statusEl.className = `badge badge-${status}`;

  document.getElementById('currentProgress').textContent = progress;
}

function displayLiveResults(results) {
  const container = document.getElementById('liveResults');

  if (results.length === 0) {
    container.innerHTML = '<p class="empty-state">No results yet...</p>';
    return;
  }

  container.innerHTML = `
    <div class="table-container">
      <table class="products-table">
        <thead>
          <tr>
            <th>Image</th>
            <th>Product Title</th>
            <th>Price (USD)</th>
            <th>Price (CAD)</th>
            <th>Website</th>
            <th>Status</th>
            <th>Rating</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${results.map(result => `
            <tr>
              <td class="product-image-cell">
                <img src="${result.image_url || '/placeholder.jpg'}" alt="${result.title}" onerror="this.src='/placeholder.jpg'" class="product-thumbnail">
              </td>
              <td class="product-title-cell">${result.title}</td>
              <td class="product-price-cell">$${result.price ? result.price.toFixed(2) : 'N/A'}</td>
              <td class="product-price-cell">${result.price ? '$' + (result.price * 1.35).toFixed(2) : 'N/A'}</td>
              <td class="product-website-cell">${result.website}</td>
              <td class="product-status-cell">${result.in_stock ? '<span class="status-badge in-stock">✅ In Stock</span>' : '<span class="status-badge out-of-stock">❌ Out of Stock</span>'}</td>
              <td class="product-rating-cell">${result.rating ? '⭐ ' + result.rating : '-'}</td>
              <td class="product-action-cell">
                <a href="${result.url}" target="_blank" class="btn btn-small btn-primary">View</a>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ==========================================
// Friend Management Functions
// ==========================================

async function addFriend(username) {
  try {
    await apiCall('/api/friends/request', {
      method: 'POST',
      body: JSON.stringify({ username })
    });

    showSuccess(`Friend request sent to ${username}`);
  } catch (error) {
    showError(error.message);
  }
}

async function acceptFriend(friendId) {
  try {
    await apiCall(`/api/friends/accept/${friendId}`, {
      method: 'POST'
    });

    showSuccess('Friend request accepted!');
    loadFriends();
  } catch (error) {
    showError(error.message);
  }
}

async function removeFriend(friendId) {
  if (!confirm('Are you sure you want to remove this friend?')) {
    return;
  }

  try {
    await apiCall(`/api/friends/${friendId}`, {
      method: 'DELETE'
    });

    showSuccess('Friend removed');
    loadFriends();
  } catch (error) {
    showError(error.message);
  }
}

// ==========================================
// Sharing Functions
// ==========================================

async function shareJob(jobId) {
  try {
    const friends = await apiCall('/api/friends');

    if (friends.length === 0) {
      showError('You have no friends to share with. Add friends first!');
      return;
    }

    const modal = document.getElementById('shareModal');
    const friendsList = document.getElementById('shareFriendsList');

    friendsList.innerHTML = friends.map(friend => `
      <div class="share-friend-item">
        <span>👤 ${friend.username} (${friend.display_name})</span>
        <button class="btn btn-small btn-primary" onclick="confirmShare(${jobId}, ${friend.friend_id}, '${friend.username}')">
          Share
        </button>
      </div>
    `).join('');

    modal.style.display = 'block';
  } catch (error) {
    showError(error.message);
  }
}

async function confirmShare(jobId, friendId, friendUsername) {
  try {
    await apiCall('/api/share', {
      method: 'POST',
      body: JSON.stringify({ jobId, friendId })
    });

    showSuccess(`Job shared with ${friendUsername}`);
    closeShareModal();
  } catch (error) {
    showError(error.message);
  }
}

function closeShareModal() {
  document.getElementById('shareModal').style.display = 'none';
}

// ==========================================
// Event Listeners
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  // Check authentication on load
  checkAuth();

  // Auth form toggles
  document.getElementById('showRegister').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('login-form').classList.remove('active');
    document.getElementById('register-form').classList.add('active');
  });

  document.getElementById('showLogin').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('register-form').classList.remove('active');
    document.getElementById('login-form').classList.add('active');
  });

  // Login form
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    await login(username, password);
  });

  // Register form
  document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('regUsername').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const displayName = document.getElementById('regDisplayName').value;

    if (password.length < 6) {
      showError('Password must be at least 6 characters');
      return;
    }

    await register(username, email, password, displayName || username);
  });

  // Logout button
  document.getElementById('logoutBtn').addEventListener('click', logout);

  // Tab switching
  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tab;

      // Update active tab button
      document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
      button.classList.add('active');

      // Update active tab content
      document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
      document.getElementById(`${tabName}-tab`).classList.add('active');

      // Load tab content
      loadTabContent(tabName);
    });
  });

  // Scrape form
  document.getElementById('scrapeForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const searchTerm = document.getElementById('searchTerm').value;
    const websites = Array.from(document.querySelectorAll('input[name="websites"]:checked'))
      .map(cb => cb.value);
    const maxResults = parseInt(document.getElementById('maxResults').value);
    const sendEmail = document.getElementById('sendEmail').checked;

    if (websites.length === 0) {
      showError('Please select at least one website');
      return;
    }

    await startScraping({
      searchTerm,
      websites,
      maxResults,
      sendEmail
    });
  });

  // Add friend form
  document.getElementById('addFriendForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('friendUsername').value;
    await addFriend(username);
    document.getElementById('friendUsername').value = '';
    loadFriends();
  });

  // Logs controls
  document.getElementById('refreshLogs').addEventListener('click', loadLogs);
  document.getElementById('logType').addEventListener('change', loadLogs);

  // Search results filter
  document.getElementById('searchResults').addEventListener('input', async (e) => {
    const searchTerm = e.target.value.trim();

    if (!searchTerm) {
      loadResults();
      return;
    }

    const container = document.getElementById('resultsContainer');
    container.innerHTML = '<p class="loading">Searching...</p>';

    try {
      const results = await apiCall(`/api/results/search/${encodeURIComponent(searchTerm)}`);

      if (results.length === 0) {
        container.innerHTML = '<p class="empty-state">No results found</p>';
        return;
      }

      container.innerHTML = results.map(result => `
        <div class="result-card">
          <img src="${result.image_url || '/placeholder.jpg'}" alt="${result.title}" onerror="this.src='/placeholder.jpg'">
          <div class="result-info">
            <h3>${result.title}</h3>
            <p class="result-price">$${result.price ? result.price.toFixed(2) : 'N/A'}</p>
            <p class="result-source">${result.website} ${result.in_stock ? '✅ In Stock' : '❌ Out of Stock'}</p>
            <a href="${result.url}" target="_blank" class="btn btn-small">View Product</a>
          </div>
        </div>
      `).join('');
    } catch (error) {
      container.innerHTML = '<p class="error">Search failed</p>';
    }
  });

  // Share modal close
  document.querySelector('.modal .close').addEventListener('click', closeShareModal);

  window.addEventListener('click', (e) => {
    const modal = document.getElementById('shareModal');
    if (e.target === modal) {
      closeShareModal();
    }
  });
});
