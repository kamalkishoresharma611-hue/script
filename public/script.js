// Global variables
let currentUser = null;
let wsConnection = null;
let currentTaskId = null;

// API Base URL
const API_BASE = window.location.origin;

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    checkLoginStatus();
    setupEventListeners();
});

// Check if user is logged in
async function checkLoginStatus() {
    try {
        const response = await fetch('/api/user');
        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            showDashboard();
            loadDashboardData();
        } else {
            showLoginScreen();
        }
    } catch (error) {
        showLoginScreen();
    }
}

// Setup event listeners
function setupEventListeners() {
    // Login form
    document.getElementById('loginBtn').addEventListener('click', handleLogin);
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            showPage(page);
        });
    });
    
    // Quick actions
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.dataset.page;
            showPage(page);
        });
    });
    
    // Create task form
    document.getElementById('createTaskForm').addEventListener('submit', handleCreateTask);
    
    // Task filter
    document.getElementById('taskFilter').addEventListener('change', loadTasks);
    
    // Refresh tasks
    document.getElementById('refreshTasksBtn').addEventListener('click', loadTasks);
    document.getElementById('refreshTasks').addEventListener('click', () => {
        loadDashboardData();
        showNotification('Dashboard refreshed', 'success');
    });
    
    // Modal close
    document.querySelector('.close-modal').addEventListener('click', () => {
        document.getElementById('consoleModal').classList.remove('active');
    });
    
    // File upload labels
    document.getElementById('cookieFileLabel').addEventListener('click', () => {
        document.getElementById('cookieFile').click();
    });
    
    document.getElementById('messageFileLabel').addEventListener('click', () => {
        document.getElementById('messageFile').click();
    });
    
    // File change handlers
    document.getElementById('cookieFile').addEventListener('change', (e) => {
        updateFileLabel('cookieFileLabel', e.target.files[0]);
    });
    
    document.getElementById('messageFile').addEventListener('change', (e) => {
        updateFileLabel('messageFileLabel', e.target.files[0]);
    });
}

// Update file upload label
function updateFileLabel(labelId, file) {
    if (file) {
        const label = document.getElementById(labelId);
        label.innerHTML = `
            <i class="fas fa-file-alt" style="font-size: 24px; margin-bottom: 10px; color: #28a745;"></i>
            <p>${file.name}</p>
            <small>${(file.size / 1024).toFixed(2)} KB</small>
        `;
    }
}

// Handle login
async function handleLogin() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    if (!username || !password) {
        showNotification('Please enter both username and password', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data.user;
            showDashboard();
            loadDashboardData();
            showNotification('Login successful!', 'success');
        } else {
            showNotification(data.error || 'Login failed', 'error');
        }
    } catch (error) {
        showNotification('Network error. Please try again.', 'error');
    }
}

// Handle logout
async function handleLogout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        currentUser = null;
        showLoginScreen();
        showNotification('Logged out successfully', 'success');
    } catch (error) {
        showNotification('Logout failed', 'error');
    }
}

// Show login screen
function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'block';
    document.getElementById('dashboard').style.display = 'none';
}

// Show dashboard
function showDashboard() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    
    // Update user info
    document.getElementById('currentUser').textContent = currentUser.username;
    document.getElementById('userRole').textContent = currentUser.role;
    document.getElementById('welcomeUser').textContent = currentUser.username;
    
    // Show/hide admin nav item
    const adminNav = document.querySelector('.admin-only');
    if (adminNav) {
        adminNav.style.display = currentUser.role === 'admin' ? 'flex' : 'none';
    }
    
    // Show dashboard page by default
    showPage('dashboard');
}

// Show specific page
function showPage(pageName) {
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === pageName) {
            item.classList.add('active');
        }
    });
    
    // Update page content
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    const pageElement = document.getElementById(`page-${pageName}`);
    if (pageElement) {
        pageElement.classList.add('active');
        document.getElementById('pageTitle').textContent = pageElement.querySelector('h2').textContent;
        
        // Load page-specific data
        switch(pageName) {
            case 'dashboard':
                loadDashboardData();
                break;
            case 'tasks':
                loadTasks();
                break;
            case 'create-task':
                // Reset form
                document.getElementById('createTaskForm').reset();
                document.getElementById('cookieFileLabel').innerHTML = `
                    <i class="fas fa-upload" style="font-size: 24px; margin-bottom: 10px; color: #667eea;"></i>
                    <p>Click to upload cookie file (.txt)</p>
                    <small>Facebook cookie data</small>
                `;
                document.getElementById('messageFileLabel').innerHTML = `
                    <i class="fas fa-upload" style="font-size: 24px; margin-bottom: 10px; color: #667eea;"></i>
                    <p>Click to upload message file (.txt)</p>
                    <small>One message per line</small>
                `;
                break;
            case 'stats':
                loadStatistics();
                break;
            case 'admin':
                if (currentUser.role === 'admin') {
                    loadAdminData();
                } else {
                    showPage('dashboard');
                }
                break;
        }
    }
}

// Load dashboard data
async function loadDashboardData() {
    try {
        const response = await fetch('/api/tasks');
        if (response.ok) {
            const data = await response.json();
            updateDashboardStats(data.tasks);
            updateRecentTasks(data.tasks);
        }
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
        showNotification('Failed to load dashboard data', 'error');
    }
}

// Update dashboard statistics
function updateDashboardStats(tasks) {
    const totalTasks = Object.keys(tasks).length;
    const activeTasks = Object.values(tasks).filter(t => t.status === 'running').length;
    const totalSent = Object.values(tasks).reduce((sum, task) => sum + (task.stats?.sent || 0), 0);
    
    document.getElementById('statTasks').textContent = totalTasks;
    document.getElementById('statActive').textContent = activeTasks;
    document.getElementById('statSent').textContent = totalSent;
}

// Update recent tasks
function updateRecentTasks(tasks) {
    const container = document.getElementById('recentTasksList');
    const userTasks = Object.values(tasks).filter(task => 
        currentUser.role === 'admin' || task.owner === currentUser.username
    );
    
    if (userTasks.length === 0) {
        container.innerHTML = '<p class="empty-state">No tasks created yet</p>';
        return;
    }
    
    const recentTasks = userTasks
        .sort((a, b) => new Date(b.created) - new Date(a.created))
        .slice(0, 5);
    
    container.innerHTML = recentTasks.map(task => `
        <div class="task-card" style="margin-bottom: 15px;">
            <div class="task-header">
                <div class="task-title">
                    <h3 style="margin: 0; font-size: 16px;">${task.name}</h3>
                    <span class="task-status ${task.status === 'running' ? 'status-running' : 'status-stopped'}" style="font-size: 11px; padding: 2px 8px;">
                        ${task.status === 'running' ? '🟢 Running' : '🔴 Stopped'}
                    </span>
                </div>
            </div>
            <div class="task-stats" style="display: flex; gap: 15px; margin-top: 10px;">
                <div class="stat-box" style="text-align: center; padding: 5px 10px; background: #f8f9fa; border-radius: 6px;">
                    <div class="value" style="font-size: 16px; font-weight: bold;">${task.stats?.sent || 0}</div>
                    <div class="label" style="font-size: 11px;">Sent</div>
                </div>
                <div class="stat-box" style="text-align: center; padding: 5px 10px; background: #f8f9fa; border-radius: 6px;">
                    <div class="value" style="font-size: 16px; font-weight: bold;">${task.delay || 5}s</div>
                    <div class="label" style="font-size: 11px;">Delay</div>
                </div>
                <div class="stat-box" style="text-align: center; padding: 5px 10px; background: #f8f9fa; border-radius: 6px;">
                    <div class="value" style="font-size: 16px; font-weight: bold;">${task.owner}</div>
                    <div class="label" style="font-size: 11px;">Owner</div>
                </div>
                <div class="stat-box" style="text-align: center; padding: 5px 10px; background: #f8f9fa; border-radius: 6px;">
                    <div class="value" style="font-size: 16px; font-weight: bold;">${new Date(task.created).toLocaleDateString()}</div>
                    <div class="label" style="font-size: 11px;">Created</div>
                </div>
            </div>
        </div>
    `).join('');
}

// Handle create task
async function handleCreateTask(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    
    // Get file contents
    const cookieFile = document.getElementById('cookieFile').files[0];
    const messageFile = document.getElementById('messageFile').files[0];
    
    if (!cookieFile || !messageFile) {
        showNotification('Please upload both cookie and message files', 'error');
        return;
    }
    
    try {
        const cookieContent = await readFileAsText(cookieFile);
        const messageContent = await readFileAsText(messageFile);
        
        const taskData = {
            name: document.getElementById('taskName').value,
            threadID: document.getElementById('threadID').value,
            delay: parseInt(document.getElementById('delay').value),
            hatersName: document.getElementById('hatersName').value,
            lastHereName: document.getElementById('lastHereName').value,
            cookieContent: cookieContent,
            messages: messageContent,
            maxMessages: document.getElementById('maxMessages').value || 0,
            autoRestart: document.getElementById('autoRestart').value === 'true'
        };
        
        const response = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taskData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification('Task created successfully!', 'success');
            showPage('tasks');
            loadTasks();
        } else {
            showNotification(data.error || 'Failed to create task', 'error');
        }
    } catch (error) {
        showNotification('Error reading files: ' + error.message, 'error');
    }
}

// Read file as text
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
}

// Load tasks
async function loadTasks() {
    try {
        const response = await fetch('/api/tasks');
        if (response.ok) {
            const data = await response.json();
            displayTasks(data.tasks);
        }
    } catch (error) {
        console.error('Failed to load tasks:', error);
        showNotification('Failed to load tasks', 'error');
    }
}

// Display tasks
function displayTasks(tasks) {
    const container = document.getElementById('tasksContainer');
    const filter = document.getElementById('taskFilter').value;
    
    let filteredTasks = Object.entries(tasks);
    
    // Apply filters
    if (filter === 'running') {
        filteredTasks = filteredTasks.filter(([_, task]) => task.status === 'running');
    } else if (filter === 'stopped') {
        filteredTasks = filteredTasks.filter(([_, task]) => task.status === 'stopped');
    } else if (filter === 'mine') {
        filteredTasks = filteredTasks.filter(([_, task]) => task.owner === currentUser.username);
    }
    
    if (filteredTasks.length === 0) {
        container.innerHTML = '<p class="empty-state">No tasks found</p>';
        return;
    }
    
    container.innerHTML = filteredTasks.map(([taskId, task]) => `
        <div class="task-card" data-task-id="${taskId}" style="margin-bottom: 15px;">
            <div class="task-header">
                <div class="task-title">
                    <h3 style="margin: 0; font-size: 18px;">${task.name}</h3>
                    <span class="task-status ${task.status === 'running' ? 'status-running' : 'status-stopped'}" style="padding: 4px 12px; border-radius: 20px; font-size: 12px;">
                        ${task.status === 'running' ? '🟢 Running' : '🔴 Stopped'}
                    </span>
                </div>
                <div class="task-actions" style="display: flex; gap: 10px;">
                    <button class="btn-small ${task.status === 'running' ? 'btn-stop' : 'btn-start'}" 
                            onclick="controlTask('${taskId}', '${task.status === 'running' ? 'stop' : 'start'}')"
                            style="padding: 6px 12px; border: none; border-radius: 6px; font-size: 12px; cursor: pointer; ${task.status === 'running' ? 'background: #dc3545; color: white;' : 'background: #28a745; color: white;'}">
                        ${task.status === 'running' ? 'Stop' : 'Start'}
                    </button>
                    <button class="btn-small btn-delete" onclick="deleteTask('${taskId}')"
                            style="padding: 6px 12px; background: #6c757d; color: white; border: none; border-radius: 6px; font-size: 12px; cursor: pointer;">
                        Delete
                    </button>
                    <button class="btn-small" onclick="showTaskConsole('${taskId}')"
                            style="padding: 6px 12px; background: #007bff; color: white; border: none; border-radius: 6px; font-size: 12px; cursor: pointer;">
                        Console
                    </button>
                </div>
            </div>
            <div class="task-info" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 15px 0;">
                <p style="margin: 5px 0;"><strong>Thread ID:</strong> ${task.threadID}</p>
                <p style="margin: 5px 0;"><strong>Owner:</strong> ${task.owner}</p>
                <p style="margin: 5px 0;"><strong>Created:</strong> ${new Date(task.created).toLocaleString()}</p>
                <p style="margin: 5px 0;"><strong>Delay:</strong> ${task.delay || 5} seconds</p>
            </div>
            <div class="task-stats" style="display: flex; gap: 20px;">
                <div class="stat-box" style="text-align: center; padding: 10px 15px; background: #f8f9fa; border-radius: 8px;">
                    <div class="value" style="font-size: 20px; font-weight: bold;">${task.stats?.sent || 0}</div>
                    <div class="label" style="font-size: 12px;">Sent</div>
                </div>
                <div class="stat-box" style="text-align: center; padding: 10px 15px; background: #f8f9fa; border-radius: 8px;">
                    <div class="value" style="font-size: 20px; font-weight: bold;">${task.stats?.failed || 0}</div>
                    <div class="label" style="font-size: 12px;">Failed</div>
                </div>
                <div class="stat-box" style="text-align: center; padding: 10px 15px; background: #f8f9fa; border-radius: 8px;">
                    <div class="value" style="font-size: 20px; font-weight: bold;">${task.stats?.loops || 0}</div>
                    <div class="label" style="font-size: 12px;">Loops</div>
                </div>
                <div class="stat-box" style="text-align: center; padding: 10px 15px; background: #f8f9fa; border-radius: 8px;">
                    <div class="value" style="font-size: 20px; font-weight: bold;">${task.messages?.length || 0}</div>
                    <div class="label" style="font-size: 12px;">Messages</div>
                </div>
            </div>
        </div>
    `).join('');
}

// Control task
async function controlTask(taskId, action) {
    try {
        const response = await fetch(`/api/tasks/${taskId}/control`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action })
        });
        
        if (response.ok) {
            showNotification(`Task ${action}ed successfully`, 'success');
            loadTasks();
            loadDashboardData();
        } else {
            const data = await response.json();
            showNotification(data.error || 'Operation failed', 'error');
        }
    } catch (error) {
        showNotification('Network error', 'error');
    }
}

// Delete task
async function deleteTask(taskId) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    try {
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showNotification('Task deleted successfully', 'success');
            loadTasks();
            loadDashboardData();
        } else {
            const data = await response.json();
            showNotification(data.error || 'Delete failed', 'error');
        }
    } catch (error) {
        showNotification('Network error', 'error');
    }
}

// Show task console
function showTaskConsole(taskId) {
    currentTaskId = taskId;
    const modal = document.getElementById('consoleModal');
    const consoleElement = document.getElementById('taskConsole');
    
    // Clear console
    consoleElement.innerHTML = '<div class="console-line info">Loading console logs...</div>';
    
    // Show modal
    modal.classList.add('active');
    
    // Load console logs
    loadConsoleLogs(taskId);
    
    // Initialize WebSocket connection for real-time updates
    initWebSocket();
}

// Load console logs
async function loadConsoleLogs(taskId) {
    try {
        const response = await fetch(`/api/tasks/${taskId}`);
        if (response.ok) {
            const data = await response.json();
            displayConsoleLogs(data.task.logs || []);
        }
    } catch (error) {
        console.error('Failed to load console logs:', error);
    }
}

// Display console logs
function displayConsoleLogs(logs) {
    const consoleElement = document.getElementById('taskConsole');
    
    if (logs.length === 0) {
        consoleElement.innerHTML = '<div class="console-line info">No logs available</div>';
        return;
    }
    
    consoleElement.innerHTML = logs.map(log => `
        <div class="console-line ${log.type}" style="margin-bottom: 5px; padding: 3px 0; border-bottom: 1px solid #333; color: ${getConsoleColor(log.type)};">
            [${new Date(log.timestamp).toLocaleTimeString()}] ${log.message}
        </div>
    `).join('');
    
    // Auto-scroll to bottom
    consoleElement.scrollTop = consoleElement.scrollHeight;
}

// Get console color based on log type
function getConsoleColor(type) {
    switch(type) {
        case 'info': return '#17a2b8';
        case 'success': return '#28a745';
        case 'error': return '#dc3545';
        case 'warning': return '#ffc107';
        default: return '#ffffff';
    }
}

// Load statistics
async function loadStatistics() {
    try {
        const response = await fetch('/api/tasks');
        if (response.ok) {
            const data = await response.json();
            updateStatistics(data.tasks);
        }
    } catch (error) {
        console.error('Failed to load statistics:', error);
        showNotification('Failed to load statistics', 'error');
    }
}

// Update statistics
function updateStatistics(tasks) {
    const totalTasks = Object.keys(tasks).length;
    const activeTasks = Object.values(tasks).filter(t => t.status === 'running').length;
    const totalSent = Object.values(tasks).reduce((sum, task) => sum + (task.stats?.sent || 0), 0);
    const totalFailed = Object.values(tasks).reduce((sum, task) => sum + (task.stats?.failed || 0), 0);
    
    document.getElementById('totalTasksStat').textContent = totalTasks;
    document.getElementById('activeTasksStat').textContent = activeTasks;
    document.getElementById('totalSentStat').textContent = totalSent;
    document.getElementById('totalFailedStat').textContent = totalFailed;
}

// Load admin data
async function loadAdminData() {
    try {
        const [usersResponse, statsResponse] = await Promise.all([
            fetch('/api/admin/users'),
            fetch('/api/admin/stats')
        ]);
        
        if (usersResponse.ok && statsResponse.ok) {
            const usersData = await usersResponse.json();
            const statsData = await statsResponse.json();
            
            displayAdminUsers(usersData.users);
            displaySystemStats(statsData);
        }
    } catch (error) {
        console.error('Failed to load admin data:', error);
        showNotification('Failed to load admin data', 'error');
    }
}

// Display admin users
function displayAdminUsers(users) {
    const tbody = document.querySelector('#usersList tbody');
    
    if (!tbody) return;
    
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No users found</td></tr>';
        return;
    }
    
    tbody.innerHTML = users.map(user => `
        <tr>
            <td>${user.username}</td>
            <td><span class="role-badge" style="background: #667eea; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${user.role}</span></td>
            <td>${user.tasks || 0}</td>
            <td>${new Date(user.created).toLocaleDateString()}</td>
            <td>${user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}</td>
            <td>
                ${user.username !== 'admin' && user.username !== currentUser.username ? `
                    <button class="btn-small btn-delete" onclick="deleteUser('${user.username}')"
                            style="padding: 4px 8px; background: #dc3545; color: white; border: none; border-radius: 4px; font-size: 11px; cursor: pointer;">
                        Delete
                    </button>
                ` : ''}
            </td>
        </tr>
    `).join('');
}

// Display system stats
function displaySystemStats(stats) {
    const container = document.getElementById('systemInfo');
    
    if (!container) return;
    
    container.innerHTML = `
        <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
            <div class="stat-card" style="background: white; border-radius: 12px; padding: 25px; box-shadow: 0 5px 20px rgba(0,0,0,0.1); text-align: center;">
                <i class="fas fa-users" style="font-size: 36px; color: #667eea; margin-bottom: 15px;"></i>
                <h3 style="font-size: 32px; margin-bottom: 5px;">${stats.totalUsers || 0}</h3>
                <p style="color: #666;">Total Users</p>
            </div>
            <div class="stat-card" style="background: white; border-radius: 12px; padding: 25px; box-shadow: 0 5px 20px rgba(0,0,0,0.1); text-align: center;">
                <i class="fas fa-tasks" style="font-size: 36px; color: #667eea; margin-bottom: 15px;"></i>
                <h3 style="font-size: 32px; margin-bottom: 5px;">${stats.totalTasks || 0}</h3>
                <p style="color: #666;">Total Tasks</p>
            </div>
            <div class="stat-card" style="background: white; border-radius: 12px; padding: 25px; box-shadow: 0 5px 20px rgba(0,0,0,0.1); text-align: center;">
                <i class="fas fa-play-circle" style="font-size: 36px; color: #667eea; margin-bottom: 15px;"></i>
                <h3 style="font-size: 32px; margin-bottom: 5px;">${stats.runningTasks || 0}</h3>
                <p style="color: #666;">Running Tasks</p>
            </div>
            <div class="stat-card" style="background: white; border-radius: 12px; padding: 25px; box-shadow: 0 5px 20px rgba(0,0,0,0.1); text-align: center;">
                <i class="fas fa-signal" style="font-size: 36px; color: #667eea; margin-bottom: 15px;"></i>
                <h3 style="font-size: 32px; margin-bottom: 5px;">${Math.floor((stats.serverUptime || 0) / 60)}m</h3>
                <p style="color: #666;">Server Uptime</p>
            </div>
        </div>
    `;
}

// Delete user
async function deleteUser(username) {
    if (username === currentUser.username) {
        showNotification('You cannot delete yourself', 'error');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete user "${username}"?`)) return;
    
    try {
        const response = await fetch(`/api/admin/users/${username}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showNotification('User deleted successfully', 'success');
            loadAdminData();
        } else {
            const data = await response.json();
            showNotification(data.error || 'Delete failed', 'error');
        }
    } catch (error) {
        showNotification('Network error', 'error');
    }
}

// Show notification
function showNotification(message, type = 'info') {
    // Remove existing notifications
    document.querySelectorAll('.notification').forEach(n => n.remove());
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 5px 20px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        gap: 12px;
        transform: translateX(150%);
        transition: transform 0.3s;
        z-index: 1001;
        border-left: 4px solid ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#ffc107'};
    `;
    
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}" 
           style="color: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#ffc107'}; font-size: 20px;"></i>
        <span>${message}</span>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Show with animation
    setTimeout(() => notification.style.transform = 'translateX(0)', 10);
    
    // Remove after 5 seconds
    setTimeout(() => {
        notification.style.transform = 'translateX(150%)';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// Initialize WebSocket connection
function initWebSocket() {
    if (wsConnection) return;
    
    const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    const wsUrl = protocol + window.location.host;
    
    wsConnection = new WebSocket(wsUrl);
    
    wsConnection.onopen = () => {
        console.log('WebSocket connected');
        // Authenticate
        wsConnection.send(JSON.stringify({
            type: 'auth',
            username: currentUser.username
        }));
    };
    
    wsConnection.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    };
    
    wsConnection.onclose = () => {
        console.log('WebSocket disconnected');
        wsConnection = null;
        // Try to reconnect after 5 seconds
        setTimeout(initWebSocket, 5000);
    };
    
    wsConnection.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
}

// Handle WebSocket messages
function handleWebSocketMessage(data) {
    switch(data.type) {
        case 'log':
            if (data.taskId === currentTaskId && document.getElementById('consoleModal').classList.contains('active')) {
                addConsoleLog(data.log);
            }
            break;
        case 'task_update':
            if (data.taskId === currentTaskId) {
                loadConsoleLogs(data.taskId);
            }
            // Refresh tasks list if it's visible
            if (document.getElementById('page-tasks').classList.contains('active')) {
                loadTasks();
            }
            // Refresh dashboard if it's visible
            if (document.getElementById('page-dashboard').classList.contains('active')) {
                loadDashboardData();
            }
            break;
        case 'auth_response':
            if (data.success) {
                console.log('WebSocket authenticated');
            }
            break;
    }
}

// Add console log
function addConsoleLog(log) {
    const consoleElement = document.getElementById('taskConsole');
    const logElement = document.createElement('div');
    logElement.className = `console-line ${log.type}`;
    logElement.style.cssText = `
        margin-bottom: 5px;
        padding: 3px 0;
        border-bottom: 1px solid #333;
        color: ${getConsoleColor(log.type)};
    `;
    logElement.innerHTML = `[${new Date(log.timestamp).toLocaleTimeString()}] ${log.message}`;
    
    consoleElement.appendChild(logElement);
    consoleElement.scrollTop = consoleElement.scrollHeight;
}

// Make functions globally available
window.controlTask = controlTask;
window.deleteTask = deleteTask;
window.showTaskConsole = showTaskConsole;
window.showPage = showPage;
window.deleteUser = deleteUser;