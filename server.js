const express = require('express');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// Session middleware
app.use(session({
    secret: 'messenger-bot-secret-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// Create directories
['data', 'cookies', 'logs', 'public'].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// File paths
const USERS_FILE = 'data/users.json';
const TASKS_FILE = 'data/tasks.json';

// ============================================
// DATA MANAGEMENT
// ============================================
function loadUsers() {
    if (fs.existsSync(USERS_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
        } catch (e) {
            console.error('Error loading users:', e);
        }
    }
    
    // Default users (passwords will be hashed)
    const defaultUsers = {
        'admin': {
            password: hashPassword('5550561'),
            role: 'admin',
            tasks: [],
            created: new Date().toISOString()
        },
        'user123': {
            password: hashPassword('user123'),
            role: 'user',
            tasks: [],
            created: new Date().toISOString()
        },
        'user1': {
            password: hashPassword('password1'),
            role: 'user',
            tasks: [],
            created: new Date().toISOString()
        },
        'user2': {
            password: hashPassword('password2'),
            role: 'user',
            tasks: [],
            created: new Date().toISOString()
        },
        'user3': {
            password: hashPassword('password3'),
            role: 'user',
            tasks: [],
            created: new Date().toISOString()
        },
        'user4': {
            password: hashPassword('password4'),
            role: 'user',
            tasks: [],
            created: new Date().toISOString()
        }
    };
    
    saveUsers(defaultUsers);
    return defaultUsers;
}

function saveUsers(users) {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    } catch (e) {
        console.error('Error saving users:', e);
    }
}

function loadTasks() {
    if (fs.existsSync(TASKS_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
        } catch (e) {
            console.error('Error loading tasks:', e);
        }
    }
    return {};
}

function saveTasks(tasks) {
    try {
        fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
    } catch (e) {
        console.error('Error saving tasks:', e);
    }
}

function hashPassword(password) {
    return bcrypt.hashSync(password, 10);
}

function verifyPassword(password, hash) {
    return bcrypt.compareSync(password, hash);
}

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================
function requireAuth(req, res, next) {
    if (req.session.user) {
        return next();
    }
    res.redirect('/login.html');
}

function requireAdmin(req, res, next) {
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    res.status(403).json({ error: 'Admin access required' });
}

// ============================================
// ROUTES
// ============================================
let users = loadUsers();
let tasks = loadTasks();

// Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }
    
    const user = users[username];
    if (!user || !verifyPassword(password, user.password)) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    req.session.user = {
        username: username,
        role: user.role
    };
    
    // Update last login
    user.lastLogin = new Date().toISOString();
    saveUsers(users);
    
    res.json({ 
        success: true, 
        user: { username: username, role: user.role }
    });
});

// Logout
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Get current user
app.get('/api/user', (req, res) => {
    if (req.session.user) {
        res.json({ user: req.session.user });
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});

// Get tasks
app.get('/api/tasks', requireAuth, (req, res) => {
    const user = req.session.user;
    const filteredTasks = {};
    
    for (const [taskId, task] of Object.entries(tasks)) {
        if (user.role === 'admin' || task.owner === user.username) {
            filteredTasks[taskId] = task;
        }
    }
    
    res.json({ tasks: filteredTasks });
});

// Create task
app.post('/api/tasks', requireAuth, (req, res) => {
    const user = req.session.user;
    const { name, threadID, delay, hatersName, lastHereName, cookieContent, messages } = req.body;
    
    if (!name || !threadID || !cookieContent || !messages) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const taskId = uuidv4();
    
    const task = {
        id: taskId,
        name: name,
        owner: user.username,
        created: new Date().toISOString(),
        status: 'stopped',
        threadID: threadID,
        delay: delay || 5,
        hatersName: hatersName || '',
        lastHereName: lastHereName || '',
        cookieContent: cookieContent,
        messages: messages.split('\n').filter(m => m.trim()),
        stats: {
            sent: 0,
            failed: 0,
            loops: 0,
            lastSuccess: null
        },
        logs: []
    };
    
    // Save cookie file
    const cookiePath = path.join('cookies', `cookie_${taskId}.txt`);
    fs.writeFileSync(cookiePath, cookieContent);
    
    // Add task
    tasks[taskId] = task;
    
    // Add to user's task list
    if (users[user.username]) {
        if (!users[user.username].tasks) users[user.username].tasks = [];
        users[user.username].tasks.push(taskId);
    }
    
    saveTasks(tasks);
    saveUsers(users);
    
    res.json({ success: true, taskId: taskId, task: task });
});

// Control task
app.post('/api/tasks/:taskId/control', requireAuth, (req, res) => {
    const taskId = req.params.taskId;
    const { action } = req.body;
    const user = req.session.user;
    
    const task = tasks[taskId];
    if (!task) {
        return res.status(404).json({ error: 'Task not found' });
    }
    
    if (user.role !== 'admin' && task.owner !== user.username) {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    if (action === 'start') {
        task.status = 'running';
        task.stats.startTime = new Date().toISOString();
        addTaskLog(taskId, 'Task started', 'info');
    } else if (action === 'stop') {
        task.status = 'stopped';
        addTaskLog(taskId, 'Task stopped', 'info');
    } else if (action === 'restart') {
        task.status = 'running';
        addTaskLog(taskId, 'Task restarted', 'info');
    }
    
    saveTasks(tasks);
    res.json({ success: true, status: task.status });
});

// Delete task
app.delete('/api/tasks/:taskId', requireAuth, (req, res) => {
    const taskId = req.params.taskId;
    const user = req.session.user;
    
    const task = tasks[taskId];
    if (!task) {
        return res.status(404).json({ error: 'Task not found' });
    }
    
    if (user.role !== 'admin' && task.owner !== user.username) {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    // Delete cookie file
    const cookiePath = path.join('cookies', `cookie_${taskId}.txt`);
    if (fs.existsSync(cookiePath)) {
        fs.unlinkSync(cookiePath);
    }
    
    // Remove from user's task list
    if (users[task.owner]) {
        const index = users[task.owner].tasks.indexOf(taskId);
        if (index > -1) {
            users[task.owner].tasks.splice(index, 1);
        }
    }
    
    // Remove task
    delete tasks[taskId];
    
    saveTasks(tasks);
    saveUsers(users);
    
    res.json({ success: true });
});

// Admin: Get all users
app.get('/api/admin/users', requireAuth, requireAdmin, (req, res) => {
    const userList = Object.entries(users).map(([username, data]) => ({
        username,
        role: data.role,
        tasks: data.tasks ? data.tasks.length : 0,
        created: data.created,
        lastLogin: data.lastLogin
    }));
    
    res.json({ users: userList });
});

// Admin: Get system stats
app.get('/api/admin/stats', requireAuth, requireAdmin, (req, res) => {
    const stats = {
        totalUsers: Object.keys(users).length,
        totalTasks: Object.keys(tasks).length,
        runningTasks: Object.values(tasks).filter(t => t.status === 'running').length,
        activeSessions: Object.keys(activeSessions).length,
        serverUptime: process.uptime()
    };
    
    res.json(stats);
});

// Helper function
function addTaskLog(taskId, message, type = 'info') {
    const task = tasks[taskId];
    if (!task) return;
    
    const log = {
        timestamp: new Date().toISOString(),
        message: message,
        type: type
    };
    
    if (!task.logs) task.logs = [];
    task.logs.unshift(log);
    
    // Keep only last 100 logs
    if (task.logs.length > 100) {
        task.logs = task.logs.slice(0, 100);
    }
    
    saveTasks(tasks);
    
    // Broadcast to WebSocket clients
    broadcastToTask(taskId, {
        type: 'log',
        taskId: taskId,
        log: log
    });
}

// ============================================
// WEB SOCKET SERVER
// ============================================
const server = app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║         🤖 Messenger Bot Manager - Node.js              ║
╠══════════════════════════════════════════════════════════╣
║ Server running on port ${PORT}                            ║
║ URL: http://localhost:${PORT}                              ║
║                                                          ║
║ ✅ WebSocket Support: ACTIVE                            ║
║ ✅ REST API: READY                                      ║
║ ✅ File Upload: ENABLED                                 ║
║ ✅ Real-time Updates: ENABLED                           ║
╚══════════════════════════════════════════════════════════╝
    `);
});

const wss = new WebSocket.Server({ server });
const activeSessions = {};

wss.on('connection', (ws, req) => {
    const sessionId = uuidv4();
    activeSessions[sessionId] = { ws, user: null };
    
    console.log(`New WebSocket connection: ${sessionId}`);
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            // Authentication
            if (data.type === 'auth') {
                const { username, token } = data;
                // In real app, validate token
                activeSessions[sessionId].user = { username };
                
                ws.send(JSON.stringify({
                    type: 'auth_success',
                    sessionId: sessionId
                }));
            }
            
            // Subscribe to task updates
            else if (data.type === 'subscribe') {
                const { taskId } = data;
                activeSessions[sessionId].subscribedTask = taskId;
                
                // Send current task state
                const task = tasks[taskId];
                if (task) {
                    ws.send(JSON.stringify({
                        type: 'task_update',
                        taskId: taskId,
                        task: task
                    }));
                }
            }
            
        } catch (error) {
            console.error('WebSocket error:', error);
        }
    });
    
    ws.on('close', () => {
        delete activeSessions[sessionId];
        console.log(`WebSocket disconnected: ${sessionId}`);
    });
});

function broadcastToTask(taskId, message) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            // Find session
            const session = Object.values(activeSessions).find(s => s.ws === client);
            if (session && session.subscribedTask === taskId) {
                client.send(JSON.stringify(message));
            }
        }
    });
}

// Auto-save every 30 seconds
setInterval(() => {
    saveTasks(tasks);
    saveUsers(users);
}, 30000);