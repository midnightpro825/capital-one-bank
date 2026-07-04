const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// ===== DATABASE SETUP =====
const dbPath = path.join(__dirname, 'banking.db');
const db = new sqlite3.Database(dbPath);

// ===== HELPER FUNCTIONS =====
function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
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

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

// ===== USER MANAGEMENT WITH DATABASE =====
app.post('/api/auth/register', async (req, res) => {
    const { name, email, phone, password, pin } = req.body;
    
    // Check if user exists
    const existing = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
    if (existing) {
        return res.status(400).json({ error: 'User already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = generateId();
    const createdAt = getCurrentDate();
    
    await dbRun(INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?), [
        userId, name, email, phone, hashedPassword,
        1000.00, pin || '1234', 'active', 'Bronze', 0,
        0.01, 2000, 10000, 0, 0, '',
        '', '', null, 'disabled', 30, createdAt, createdAt
    ]);
    
    // Create wallets
    const providers = ['MTN', 'Airtel', 'Vodafone', 'Tigo'];
    for (const provider of providers) {
        await dbRun(INSERT INTO mobile_wallets VALUES (?, ?, ?, ?, ?, ?, ?, ?), [
            generateId(), userId, phone, provider,
            0, 'USD', 'active', createdAt
        ]);
    }
    
    const token = jwt.sign({ id: userId, email }, SECRET_KEY, { expiresIn: '7d' });
    
    res.status(201).json({
        message: 'Registration successful',
        token,
        user: {
            id: userId,
            name,
            email,
            phone,
            balance: 1000.00,
            tier: 'Bronze',
            loyaltyPoints: 0
        }
    });
});

// ===== GET DASHBOARD FROM DATABASE =====
app.get('/api/dashboard/:userId', async (req, res) => {
    const { userId } = req.params;
    
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    const wallets = await dbAll('SELECT * FROM mobile_wallets WHERE userId = ?', [userId]);
    const transactions = await dbAll('SELECT * FROM transactions WHERE userId = ? ORDER BY timestamp DESC LIMIT 10', [userId]);
    const savings = await dbAll('SELECT * FROM savings_goals WHERE userId = ?', [userId]);
    const loans = await dbAll('SELECT * FROM loans WHERE userId = ?', [userId]);
    const notifications = await dbAll('SELECT * FROM notifications WHERE userId = ? AND read = 0 ORDER BY createdAt DESC LIMIT 5', [userId]);
    
    const totalWalletBalance = wallets.reduce((sum, w) => sum + w.balance, 0);
    const savingsTotal = savings.reduce((sum, s) => sum + s.currentAmount, 0);
    
    res.json({
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
});

console.log('✅ Database integration complete!');
