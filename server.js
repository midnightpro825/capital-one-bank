const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || 'your-secret-key-here-2026';

// ===== DATABASE SETUP - FIXED FOR RENDER =====
// Render's /tmp directory is writable
const dbPath = process.env.RENDER ? '/tmp/banking.db' : './banking.db';
console.log('📁 Database path:', dbPath);

// Only create directory for local development
if (!process.env.RENDER) {
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
}

const db = new sqlite3.Database(dbPath);

// ===== CREATE TABLES =====
function createTables() {
    console.log('📊 Creating database tables...');
    
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT NOT NULL,
        password TEXT NOT NULL,
        balance REAL DEFAULT 1000,
        pin TEXT DEFAULT '1234',
        status TEXT DEFAULT 'active',
        tier TEXT DEFAULT 'Bronze',
        loyaltyPoints INTEGER DEFAULT 0,
        cashbackRate REAL DEFAULT 0.01,
        dailyLimit REAL DEFAULT 2000,
        monthlyLimit REAL DEFAULT 10000,
        kycVerified INTEGER DEFAULT 0,
        kycSubmitted INTEGER DEFAULT 0,
        address TEXT,
        dob TEXT,
        gender TEXT,
        profilePicture TEXT,
        twoFactor TEXT DEFAULT 'disabled',
        sessionTimeout INTEGER DEFAULT 30,
        createdAt TEXT NOT NULL,
        lastLogin TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS mobile_wallets (
        walletId TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        phoneNumber TEXT NOT NULL,
        provider TEXT NOT NULL,
        balance REAL DEFAULT 0,
        currency TEXT DEFAULT 'USD',
        status TEXT DEFAULT 'active',
        createdAt TEXT NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        userId TEXT NOT NULL,
        senderId TEXT,
        receiverId TEXT,
        senderPhone TEXT,
        receiverPhone TEXT,
        provider TEXT,
        amount REAL NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'completed',
        timestamp TEXT NOT NULL,
        reference TEXT,
        FOREIGN KEY (userId) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS savings_goals (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        goal TEXT NOT NULL,
        targetAmount REAL NOT NULL,
        currentAmount REAL DEFAULT 0,
        deadline TEXT,
        autoSave INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        createdAt TEXT NOT NULL,
        progress REAL DEFAULT 0,
        FOREIGN KEY (userId) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS loans (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        amount REAL NOT NULL,
        purpose TEXT,
        duration INTEGER DEFAULT 12,
        interestRate REAL DEFAULT 0.10,
        totalRepayment REAL NOT NULL,
        monthlyPayment REAL NOT NULL,
        remainingBalance REAL NOT NULL,
        status TEXT DEFAULT 'active',
        disbursed INTEGER DEFAULT 1,
        createdAt TEXT NOT NULL,
        nextPaymentDate TEXT,
        FOREIGN KEY (userId) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT DEFAULT 'system',
        read INTEGER DEFAULT 0,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id)
    )`);

    console.log('✅ Tables created successfully!');
}

// Create tables on startup
createTables();

// ===== HELPER FUNCTIONS =====
function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// ===== CREATE TEST USER =====
async function createTestUser() {
    try {
        const count = await dbGet('SELECT COUNT(*) as count FROM users');
        if (count.count === 0) {
            console.log('👤 Creating test user...');
            const hashedPassword = await bcrypt.hash('password123', 10);
            const userId = uuidv4();
            const createdAt = new Date().toISOString();
            
            await dbRun(`INSERT INTO users (id, name, email, phone, password, balance, pin, status, tier, loyaltyPoints, cashbackRate, dailyLimit, monthlyLimit, kycVerified, kycSubmitted, address, dob, gender, profilePicture, twoFactor, sessionTimeout, createdAt, lastLogin) 
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                userId, 'Test User', 'test@example.com', '+1 234 567 890', hashedPassword,
                5000.00, '1234', 'active', 'Silver', 1500,
                0.02, 2000, 10000, 1, 1, '123 Test Street, New York, NY 10001',
                '1990-01-01', 'male', null, 'disabled', 30, createdAt, createdAt
            ]);
            
            const providers = ['MTN', 'Airtel', 'Vodafone', 'Tigo'];
            for (const provider of providers) {
                await dbRun(`INSERT INTO mobile_wallets (walletId, userId, phoneNumber, provider, balance, currency, status, createdAt) 
                    VALUES (?,?,?,?,?,?,?,?)`, [
                    uuidv4(), userId, '+1 234 567 890', provider,
                    provider === 'MTN' ? 2500 : 500, 'USD', 'active', createdAt
                ]);
            }
            console.log('✅ Test user created: test@example.com / password123');
        }
    } catch (error) {
        console.error('Error creating test user:', error);
    }
}

// ============================================
// USER AUTH ROUTES
// ============================================

app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, phone, password, pin } = req.body;
        
        if (!name || !email || !phone || !password || !pin) {
            return res.status(400).json({ success: false, error: 'All fields are required' });
        }
        
        if (password.length < 8) {
            return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
        }
        
        if (!/^\d{4}$/.test(pin)) {
            return res.status(400).json({ success: false, error: 'PIN must be 4 digits' });
        }
        
        const existing = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
        if (existing) {
            return res.status(400).json({ success: false, error: 'User already exists' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = uuidv4();
        const createdAt = new Date().toISOString();
        
        await dbRun(`INSERT INTO users (id, name, email, phone, password, balance, pin, status, tier, loyaltyPoints, cashbackRate, dailyLimit, monthlyLimit, kycVerified, kycSubmitted, address, dob, gender, profilePicture, twoFactor, sessionTimeout, createdAt, lastLogin) 
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
            userId, name, email, phone, hashedPassword,
            1000.00, pin, 'active', 'Bronze', 0,
            0.01, 2000, 10000, 0, 0, '',
            '', '', null, 'disabled', 30, createdAt, createdAt
        ]);
        
        const providers = ['MTN', 'Airtel', 'Vodafone', 'Tigo'];
        for (const provider of providers) {
            await dbRun(`INSERT INTO mobile_wallets (walletId, userId, phoneNumber, provider, balance, currency, status, createdAt) 
                VALUES (?,?,?,?,?,?,?,?)`, [
                uuidv4(), userId, phone, provider,
                0, 'USD', 'active', createdAt
            ]);
        }
        
        const token = jwt.sign({ id: userId, email: email }, SECRET_KEY, { expiresIn: '7d' });
        
        res.status(201).json({
            success: true,
            message: 'Registration successful',
            token: token,
            user: {
                id: userId,
                name: name,
                email: email,
                phone: phone,
                balance: 1000.00,
                tier: 'Bronze',
                loyaltyPoints: 0
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Email and password are required' });
        }
        
        const user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
        if (!user) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }
        
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }
        
        await dbRun('UPDATE users SET lastLogin = ? WHERE id = ?', [new Date().toISOString(), user.id]);
        
        const token = jwt.sign({ id: user.id, email: user.email }, SECRET_KEY, { expiresIn: '7d' });
        
        res.json({
            success: true,
            message: 'Login successful',
            token: token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                balance: user.balance,
                tier: user.tier,
                loyaltyPoints: user.loyaltyPoints
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// ADMIN AUTHENTICATION
// ============================================

const ADMIN_EMAIL = 'admin@capitalone.com';
const ADMIN_PASSWORD = 'Admin@2026';

app.post('/api/admin/login', async (req, res) => {
    const { email, password } = req.body;
    
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        const token = jwt.sign({ role: 'admin', email: email }, SECRET_KEY, { expiresIn: '1d' });
        return res.json({
            success: true,
            message: 'Admin login successful',
            token: token,
            admin: {
                name: 'Administrator',
                email: ADMIN_EMAIL,
                role: 'admin'
            }
        });
    }
    res.status(401).json({ 
        success: false,
        error: 'Invalid admin credentials'
    });
});

// Admin middleware
function authenticateAdmin(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ success: false, error: 'No token provided' });
    }
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        if (decoded.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        req.admin = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ success: false, error: 'Invalid token' });
    }
}

// ============================================
// ADMIN ROUTES
// ============================================

app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
    try {
        const users = await dbAll('SELECT id, name, email, phone, balance, status, tier, createdAt FROM users ORDER BY createdAt DESC');
        res.json({
            success: true,
            users: users,
            total: users.length
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/admin/stats', authenticateAdmin, async (req, res) => {
    try {
        const totalUsers = await dbGet('SELECT COUNT(*) as count FROM users');
        const activeUsers = await dbGet('SELECT COUNT(*) as count FROM users WHERE status = "active"');
        const totalBalance = await dbGet('SELECT SUM(balance) as total FROM users');
        const totalTransactions = await dbGet('SELECT COUNT(*) as count FROM transactions');
        
        res.json({
            success: true,
            stats: {
                totalUsers: totalUsers?.count || 0,
                activeUsers: activeUsers?.count || 0,
                totalBalance: totalBalance?.total || 0,
                totalTransactions: totalTransactions?.count || 0
            }
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/admin/users/add-funds', authenticateAdmin, async (req, res) => {
    try {
        const { userId, amount, provider } = req.body;
        
        if (!userId || !amount || amount <= 0) {
            return res.status(400).json({ success: false, error: 'Valid amount and user ID required' });
        }
        
        const user = await dbGet('SELECT * FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        
        const oldBalance = user.balance;
        const newBalance = oldBalance + amount;
        
        await dbRun('UPDATE users SET balance = ? WHERE id = ?', [newBalance, userId]);
        console.log(`✅ Updated balance for ${user.name} from $${oldBalance} to $${newBalance}`);
        
        if (provider) {
            await dbRun('UPDATE mobile_wallets SET balance = balance + ? WHERE userId = ? AND provider = ?', [amount, userId, provider]);
        }
        
        const updatedUser = await dbGet('SELECT id, name, email, phone, balance, status, tier FROM users WHERE id = ?', [userId]);
        
        res.json({
            success: true,
            message: 'Funds added successfully',
            user: updatedUser,
            oldBalance: oldBalance,
            newBalance: newBalance
        });
    } catch (error) {
        console.error('Add funds error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/admin/users/deduct-funds', authenticateAdmin, async (req, res) => {
    try {
        const { userId, amount, provider } = req.body;
        
        if (!userId || !amount || amount <= 0) {
            return res.status(400).json({ success: false, error: 'Valid amount and user ID required' });
        }
        
        const user = await dbGet('SELECT * FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        
        if (user.balance < amount) {
            return res.status(400).json({ success: false, error: 'Insufficient balance' });
        }
        
        const oldBalance = user.balance;
        const newBalance = oldBalance - amount;
        
        await dbRun('UPDATE users SET balance = ? WHERE id = ?', [newBalance, userId]);
        console.log(`✅ Updated balance for ${user.name} from $${oldBalance} to $${newBalance}`);
        
        if (provider) {
            await dbRun('UPDATE mobile_wallets SET balance = balance - ? WHERE userId = ? AND provider = ?', [amount, userId, provider]);
        }
        
        const updatedUser = await dbGet('SELECT id, name, email, phone, balance, status, tier FROM users WHERE id = ?', [userId]);
        
        res.json({
            success: true,
            message: 'Funds deducted successfully',
            user: updatedUser,
            oldBalance: oldBalance,
            newBalance: newBalance
        });
    } catch (error) {
        console.error('Deduct funds error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// DASHBOARD ROUTE
// ============================================

app.get('/api/dashboard/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        
        const user = await dbGet('SELECT * FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        
        const wallets = await dbAll('SELECT * FROM mobile_wallets WHERE userId = ?', [userId]);
        const transactions = await dbAll('SELECT * FROM transactions WHERE userId = ? ORDER BY timestamp DESC LIMIT 10', [userId]);
        const savings = await dbAll('SELECT * FROM savings_goals WHERE userId = ?', [userId]);
        const loans = await dbAll('SELECT * FROM loans WHERE userId = ?', [userId]);
        const notifications = await dbAll('SELECT * FROM notifications WHERE userId = ? ORDER BY createdAt DESC LIMIT 5', [userId]);
        
        res.json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                balance: user.balance,
                tier: user.tier,
                loyaltyPoints: user.loyaltyPoints
            },
            wallets: wallets,
            transactions: transactions,
            savings: savings,
            loans: loans,
            notifications: notifications,
            stats: {
                totalBalance: user.balance,
                mobileBalance: wallets.reduce((sum, w) => sum + w.balance, 0),
                totalTransactions: transactions.length,
                savingsTotal: savings.reduce((sum, s) => sum + s.currentAmount, 0)
            }
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// TEST ROUTE
// ============================================

app.get('/api/test', (req, res) => {
    res.json({ 
        success: true,
        message: 'API is working!',
        timestamp: new Date().toISOString()
    });
});

// ============================================
// SERVE HTML
// ============================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/admin-login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-login.html'));
});

app.get('/admin-dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-dashboard.html'));
});

// ============================================
// START SERVER
// ============================================

// Create test user after tables are ready
createTestUser().catch(console.error);

app.listen(PORT, () => {
    console.log('');
    console.log('========================================');
    console.log('👑 Capital One Bank Server');
    console.log('📍 http://localhost:' + PORT);
    console.log('📱 API Test: http://localhost:3000/api/test');
    console.log('========================================');
    console.log('👑 Admin: admin@capitalone.com / Admin@2026');
    console.log('📱 User: test@example.com / password123');
    console.log('========================================');
});

module.exports = app;