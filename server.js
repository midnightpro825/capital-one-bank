const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = 3000;
const SECRET_KEY = 'your-secret-key-here-2026';

// ===== DATABASE =====
const db = new sqlite3.Database('banking.db');

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// ===== HELPERS =====
function generateId() {
    return uuidv4();
}

function getCurrentDate() {
    return new Date().toISOString();
}

function dbGet(sql, params) {
    params = params || [];
    return new Promise(function(resolve, reject) {
        db.get(sql, params, function(err, row) {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function dbRun(sql, params) {
    params = params || [];
    return new Promise(function(resolve, reject) {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function dbAll(sql, params) {
    params = params || [];
    return new Promise(function(resolve, reject) {
        db.all(sql, params, function(err, rows) {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

// ============================================
// USER AUTH ROUTES - MUST BE FIRST
// ============================================

app.post('/api/auth/register', async function(req, res) {
    try {
        var name = req.body.name;
        var email = req.body.email;
        var phone = req.body.phone;
        var password = req.body.password;
        var pin = req.body.pin;
        
        console.log('📝 Registration attempt:', { name: name, email: email });
        
        if (!name || !email || !phone || !password || !pin) {
            return res.status(400).json({ success: false, error: 'All fields are required' });
        }
        
        if (password.length < 8) {
            return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
        }
        
        if (!/^\d{4}$/.test(pin)) {
            return res.status(400).json({ success: false, error: 'PIN must be 4 digits' });
        }
        
        var existing = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
        if (existing) {
            return res.status(400).json({ success: false, error: 'User already exists' });
        }
        
        var hashedPassword = await bcrypt.hash(password, 10);
        var userId = generateId();
        var createdAt = getCurrentDate();
        
        var insertUserSQL = 'INSERT INTO users (id, name, email, phone, password, balance, pin, status, tier, loyaltyPoints, cashbackRate, dailyLimit, monthlyLimit, kycVerified, kycSubmitted, address, dob, gender, profilePicture, twoFactor, sessionTimeout, createdAt, lastLogin) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)';
        
        await dbRun(insertUserSQL, [
            userId, name, email, phone, hashedPassword,
            1000.00, pin, 'active', 'Bronze', 0,
            0.01, 2000, 10000, 0, 0, '',
            '', '', null, 'disabled', 30, createdAt, createdAt
        ]);
        
        var providers = ['MTN', 'Airtel', 'Vodafone', 'Tigo'];
        var walletSQL = 'INSERT INTO mobile_wallets (walletId, userId, phoneNumber, provider, balance, currency, status, createdAt) VALUES (?,?,?,?,?,?,?,?)';
        
        for (var i = 0; i < providers.length; i++) {
            var provider = providers[i];
            await dbRun(walletSQL, [
                generateId(), userId, phone, provider,
                0, 'USD', 'active', createdAt
            ]);
        }
        
        var token = jwt.sign({ id: userId, email: email }, SECRET_KEY, { expiresIn: '7d' });
        
        console.log('✅ Registration successful for:', email);
        
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
        console.error('❌ Registration error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/auth/login', async function(req, res) {
    try {
        var email = req.body.email;
        var password = req.body.password;
        
        console.log('🔑 Login attempt:', { email: email });
        
        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Email and password are required' });
        }
        
        var user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
        if (!user) {
            console.log('❌ User not found:', email);
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }
        
        var validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            console.log('❌ Invalid password for:', email);
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }
        
        await dbRun('UPDATE users SET lastLogin = ? WHERE id = ?', [getCurrentDate(), user.id]);
        
        var token = jwt.sign({ id: user.id, email: user.email }, SECRET_KEY, { expiresIn: '7d' });
        
        console.log('✅ Login successful for:', email);
        
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
        console.error('❌ Login error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// USER DASHBOARD - FIXED
// ============================================
app.get('/api/dashboard/:userId', async function(req, res) {
    try {
        var userId = req.params.userId;
        console.log('📊 Dashboard requested for user:', userId);
        
        var user = await dbGet('SELECT * FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        
        console.log('💰 User balance: $' + user.balance);
        
        var wallets = await dbAll('SELECT * FROM mobile_wallets WHERE userId = ?', [userId]);
        var transactions = await dbAll('SELECT * FROM transactions WHERE userId = ? ORDER BY timestamp DESC LIMIT 10', [userId]);
        var savings = await dbAll('SELECT * FROM savings_goals WHERE userId = ?', [userId]);
        var loans = await dbAll('SELECT * FROM loans WHERE userId = ?', [userId]);
        var notifications = await dbAll('SELECT * FROM notifications WHERE userId = ? ORDER BY createdAt DESC LIMIT 5', [userId]);
        
        var totalWalletBalance = 0;
        for (var w = 0; w < wallets.length; w++) {
            totalWalletBalance += wallets[w].balance;
        }
        
        var savingsTotal = 0;
        for (var s = 0; s < savings.length; s++) {
            savingsTotal += savings[s].currentAmount;
        }
        
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
                mobileBalance: totalWalletBalance,
                totalTransactions: transactions.length,
                savingsTotal: savingsTotal,
                notificationCount: notifications.length
            }
        });
    } catch (error) {
        console.error('❌ Dashboard error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// ADMIN AUTH
// ============================================
var ADMIN_EMAIL = 'admin@capitalone.com';
var ADMIN_PASSWORD = 'Admin@2026';

app.post('/api/admin/login', async function(req, res) {
    var email = req.body.email;
    var password = req.body.password;
    console.log('👑 Admin login attempt:', email);
    
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        var token = jwt.sign({ role: 'admin', email: email }, SECRET_KEY, { expiresIn: '1d' });
        console.log('✅ Admin login successful');
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
    console.log('❌ Admin login failed');
    res.status(401).json({ 
        success: false,
        error: 'Invalid admin credentials'
    });
});

// Admin middleware
function authenticateAdmin(req, res, next) {
    var token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ success: false, error: 'No token provided' });
    }
    try {
        var decoded = jwt.verify(token, SECRET_KEY);
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

// GET ALL USERS
app.get('/api/admin/users', authenticateAdmin, async function(req, res) {
    try {
        console.log('📊 Admin fetching all users...');
        var users = await dbAll('SELECT id, name, email, phone, balance, status, tier, createdAt FROM users ORDER BY createdAt DESC');
        console.log('✅ Found ' + users.length + ' users');
        res.json({
            success: true,
            users: users,
            total: users.length
        });
    } catch (error) {
        console.error('❌ Error fetching users:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET ADMIN STATS
app.get('/api/admin/stats', authenticateAdmin, async function(req, res) {
    try {
        console.log('📊 Admin fetching stats...');
        var totalUsers = await dbGet('SELECT COUNT(*) as count FROM users');
        var activeUsers = await dbGet('SELECT COUNT(*) as count FROM users WHERE status = "active"');
        var totalBalance = await dbGet('SELECT SUM(balance) as total FROM users');
        var totalTransactions = await dbGet('SELECT COUNT(*) as count FROM transactions');
        var totalWallets = await dbGet('SELECT COUNT(*) as count FROM mobile_wallets');
        
        console.log('✅ Total Users: ' + (totalUsers?.count || 0));
        res.json({
            success: true,
            stats: {
                totalUsers: totalUsers?.count || 0,
                activeUsers: activeUsers?.count || 0,
                totalBalance: totalBalance?.total || 0,
                totalTransactions: totalTransactions?.count || 0,
                totalWallets: totalWallets?.count || 0
            }
        });
    } catch (error) {
        console.error('❌ Error fetching stats:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ADD FUNDS
app.post('/api/admin/users/add-funds', authenticateAdmin, async function(req, res) {
    try {
        var userId = req.body.userId;
        var amount = req.body.amount;
        var provider = req.body.provider || '';
        var description = req.body.description || 'Admin fund addition';
        
        console.log('💰 Adding funds:', { userId: userId, amount: amount, provider: provider });
        
        if (!userId || !amount || amount <= 0) {
            return res.status(400).json({ success: false, error: 'Valid amount and user ID required' });
        }
        
        var user = await dbGet('SELECT * FROM users WHERE id = ?', [userId]);
        if (!user) {
            console.log('❌ User not found:', userId);
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        
        var oldBalance = user.balance;
        var newBalance = oldBalance + amount;
        
        await dbRun('UPDATE users SET balance = ? WHERE id = ?', [newBalance, userId]);
        console.log('✅ Updated balance for ' + user.name + ' from $' + oldBalance + ' to $' + newBalance);
        
        if (provider) {
            var wallet = await dbGet('SELECT * FROM mobile_wallets WHERE userId = ? AND provider = ?', [userId, provider]);
            if (wallet) {
                var newWalletBalance = wallet.balance + amount;
                await dbRun('UPDATE mobile_wallets SET balance = ? WHERE userId = ? AND provider = ?', [newWalletBalance, userId, provider]);
            } else {
                await dbRun('INSERT INTO mobile_wallets (walletId, userId, phoneNumber, provider, balance, currency, status, createdAt) VALUES (?,?,?,?,?,?,?,?)', [
                    generateId(), userId, user.phone, provider, amount, 'USD', 'active', getCurrentDate()
                ]);
            }
        }
        
        var transactionId = generateId();
        var ref = 'ADMIN-' + generateId().substring(0, 8).toUpperCase();
        var insertTxSQL = 'INSERT INTO transactions (id, type, userId, amount, provider, description, status, timestamp, reference) VALUES (?,?,?,?,?,?,?,?,?)';
        await dbRun(insertTxSQL, [
            transactionId, 'admin_deposit', userId, amount, 
            provider || 'Bank', description, 
            'completed', getCurrentDate(), ref
        ]);
        
        var notifSQL = 'INSERT INTO notifications (id, userId, message, type, read, createdAt) VALUES (?,?,?,?,?,?)';
        await dbRun(notifSQL, [
            generateId(), userId, 
            '💰 $' + amount.toFixed(2) + ' has been added to your account' + (provider ? ' (' + provider + ' wallet)' : '') + ' by Admin',
            'system', 0, getCurrentDate()
        ]);
        
        var updatedUser = await dbGet('SELECT id, name, email, phone, balance, status, tier FROM users WHERE id = ?', [userId]);
        
        res.json({
            success: true,
            message: 'Funds added successfully',
            user: updatedUser,
            oldBalance: oldBalance,
            newBalance: newBalance,
            amount: amount
        });
    } catch (error) {
        console.error('❌ Add funds error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// DEDUCT FUNDS
app.post('/api/admin/users/deduct-funds', authenticateAdmin, async function(req, res) {
    try {
        var userId = req.body.userId;
        var amount = req.body.amount;
        var provider = req.body.provider || '';
        var description = req.body.description || 'Admin fund deduction';
        
        console.log('💰 Deducting funds:', { userId: userId, amount: amount, provider: provider });
        
        if (!userId || !amount || amount <= 0) {
            return res.status(400).json({ success: false, error: 'Valid amount and user ID required' });
        }
        
        var user = await dbGet('SELECT * FROM users WHERE id = ?', [userId]);
        if (!user) {
            console.log('❌ User not found:', userId);
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        
        if (user.balance < amount) {
            return res.status(400).json({ success: false, error: 'Insufficient balance. User has $' + user.balance });
        }
        
        var oldBalance = user.balance;
        var newBalance = oldBalance - amount;
        
        await dbRun('UPDATE users SET balance = ? WHERE id = ?', [newBalance, userId]);
        console.log('✅ Updated balance for ' + user.name + ' from $' + oldBalance + ' to $' + newBalance);
        
        if (provider) {
            var wallet = await dbGet('SELECT * FROM mobile_wallets WHERE userId = ? AND provider = ?', [userId, provider]);
            if (wallet && wallet.balance >= amount) {
                var newWalletBalance = wallet.balance - amount;
                await dbRun('UPDATE mobile_wallets SET balance = ? WHERE userId = ? AND provider = ?', [newWalletBalance, userId, provider]);
            }
        }
        
        var transactionId = generateId();
        var ref = 'ADMIN-' + generateId().substring(0, 8).toUpperCase();
        var insertTxSQL = 'INSERT INTO transactions (id, type, userId, amount, provider, description, status, timestamp, reference) VALUES (?,?,?,?,?,?,?,?,?)';
        await dbRun(insertTxSQL, [
            transactionId, 'admin_deduction', userId, amount, 
            provider || 'Bank', description, 
            'completed', getCurrentDate(), ref
        ]);
        
        var notifSQL = 'INSERT INTO notifications (id, userId, message, type, read, createdAt) VALUES (?,?,?,?,?,?)';
        await dbRun(notifSQL, [
            generateId(), userId, 
            '💰 $' + amount.toFixed(2) + ' has been deducted from your account' + (provider ? ' (' + provider + ' wallet)' : '') + ' by Admin',
            'system', 0, getCurrentDate()
        ]);
        
        var updatedUser = await dbGet('SELECT id, name, email, phone, balance, status, tier FROM users WHERE id = ?', [userId]);
        
        res.json({
            success: true,
            message: 'Funds deducted successfully',
            user: updatedUser,
            oldBalance: oldBalance,
            newBalance: newBalance,
            amount: amount
        });
    } catch (error) {
        console.error('❌ Deduct funds error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// RESET PASSWORD
app.post('/api/admin/users/reset-password', authenticateAdmin, async function(req, res) {
    try {
        var userId = req.body.userId;
        var newPassword = req.body.newPassword;
        console.log('🔑 Resetting password for user:', userId);
        
        if (!userId || !newPassword) {
            return res.status(400).json({ success: false, error: 'User ID and new password required' });
        }
        
        if (newPassword.length < 8) {
            return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
        }
        
        var user = await dbGet('SELECT * FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        
        var hashedPassword = await bcrypt.hash(newPassword, 10);
        await dbRun('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);
        
        console.log('✅ Password reset for user:', user.name);
        
        var notifSQL = 'INSERT INTO notifications (id, userId, message, type, read, createdAt) VALUES (?,?,?,?,?,?)';
        await dbRun(notifSQL, [
            generateId(), userId, 
            '🔑 Your password has been reset by Admin',
            'system', 0, getCurrentDate()
        ]);
        
        res.json({
            success: true,
            message: 'Password reset successfully'
        });
    } catch (error) {
        console.error('❌ Reset password error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// TEST ROUTE - FOR DEBUGGING
// ============================================
app.get('/api/test', function(req, res) {
    res.json({ 
        success: true,
        message: 'API is working!',
        timestamp: new Date().toISOString()
    });
});

// ============================================
// SERVE HTML - MUST BE AT THE END
// ============================================
app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/login.html', function(req, res) {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/dashboard.html', function(req, res) {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/admin-login.html', function(req, res) {
    res.sendFile(path.join(__dirname, 'admin-login.html'));
});

app.get('/admin-dashboard.html', function(req, res) {
    res.sendFile(path.join(__dirname, 'admin-dashboard.html'));
});

// ============================================
// START
// ============================================
app.listen(PORT, function() {
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
