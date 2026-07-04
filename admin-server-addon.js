// ===== ADMIN CREDENTIALS =====
const ADMIN_EMAIL = 'admin@wealthwise.com';
const ADMIN_PASSWORD = 'admin123';
const ADMIN_KEY = 'ADMIN_SECRET_KEY_2026';

// ===== ADMIN AUTH =====
app.post('/api/admin/login', async (req, res) => {
    const { email, password } = req.body;
    
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        const token = jwt.sign({ role: 'admin' }, SECRET_KEY, { expiresIn: '1d' });
        return res.json({
            message: 'Admin login successful',
            token: token,
            admin: {
                name: 'Administrator',
                email: ADMIN_EMAIL,
                role: 'admin'
            }
        });
    }
    
    res.status(401).json({ error: 'Invalid admin credentials' });
});

// ===== ADMIN: GET ALL USERS =====
app.get('/api/admin/users', authenticateAdmin, (req, res) => {
    const usersList = users.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        balance: u.balance,
        status: u.status,
        tier: u.tier,
        loyaltyPoints: u.loyaltyPoints,
        createdAt: u.createdAt,
        wallets: mobileWallets.filter(w => w.userId === u.id),
        transactionCount: transactions.filter(t => t.userId === u.id || t.senderId === u.id).length
    }));
    
    res.json({
        users: usersList,
        total: usersList.length,
        stats: {
            totalBalance: usersList.reduce((sum, u) => sum + u.balance, 0),
            activeUsers: usersList.filter(u => u.status === 'active').length,
            totalTransactions: transactions.length
        }
    });
});

// ===== ADMIN: GET SINGLE USER =====
app.get('/api/admin/users/:userId', authenticateAdmin, (req, res) => {
    const { userId } = req.params;
    const user = users.find(u => u.id === userId);
    
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    const userWallets = mobileWallets.filter(w => w.userId === userId);
    const userTransactions = transactions.filter(t => 
        t.userId === userId || t.senderId === userId || t.receiverId === userId
    );
    
    res.json({
        user: user,
        wallets: userWallets,
        transactions: userTransactions,
        transactionCount: userTransactions.length
    });
});

// ===== ADMIN: ADD FUNDS TO USER =====
app.post('/api/admin/users/add-funds', authenticateAdmin, (req, res) => {
    const { userId, amount, provider, description } = req.body;
    
    if (!userId || !amount || amount <= 0) {
        return res.status(400).json({ error: 'Valid amount and user ID required' });
    }
    
    const user = users.find(u => u.id === userId);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    // Add to main balance
    user.balance += amount;
    
    // Add to specific wallet if provider specified
    if (provider) {
        let wallet = mobileWallets.find(w => w.userId === userId && w.provider === provider);
        if (!wallet) {
            // Create wallet if doesn't exist
            wallet = {
                walletId: generateId(),
                userId: user.id,
                phoneNumber: user.phone,
                provider: provider,
                balance: 0,
                currency: 'USD',
                status: 'active',
                createdAt: getCurrentDate()
            };
            mobileWallets.push(wallet);
        }
        wallet.balance += amount;
    }
    
    // Create transaction record
    const transaction = {
        id: generateId(),
        type: 'admin_deposit',
        userId: user.id,
        amount: amount,
        provider: provider || 'Bank',
        description: description || 'Admin fund addition',
        status: 'completed',
        timestamp: getCurrentDate(),
        reference: 'ADMIN-' + generateId().substring(0, 8).toUpperCase()
    };
    transactions.push(transaction);
    
    // Send notification to user
    notifications.push({
        id: generateId(),
        userId: user.id,
        message: '💰 ' + formatCurrency(amount) + ' has been added to your account' + (provider ? ' (' + provider + ' wallet)' : '') + ' by Admin',
        type: 'system',
        read: false,
        createdAt: getCurrentDate()
    });
    
    // Log admin action
    console.log('✅ Admin added ' + formatCurrency(amount) + ' to user: ' + user.name);
    
    res.json({
        message: 'Funds added successfully',
        user: {
            id: user.id,
            name: user.name,
            balance: user.balance
        },
        wallet: provider ? mobileWallets.find(w => w.userId === userId && w.provider === provider) : null,
        transaction: transaction
    });
});

// ===== ADMIN: DEDUCT FUNDS FROM USER =====
app.post('/api/admin/users/deduct-funds', authenticateAdmin, (req, res) => {
    const { userId, amount, provider, description } = req.body;
    
    if (!userId || !amount || amount <= 0) {
        return res.status(400).json({ error: 'Valid amount and user ID required' });
    }
    
    const user = users.find(u => u.id === userId);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    // Deduct from specific wallet if provider specified
    if (provider) {
        const wallet = mobileWallets.find(w => w.userId === userId && w.provider === provider);
        if (!wallet) {
            return res.status(404).json({ error: 'Wallet not found for provider: ' + provider });
        }
        if (wallet.balance < amount) {
            return res.status(400).json({ error: 'Insufficient balance in ' + provider + ' wallet' });
        }
        wallet.balance -= amount;
    } else {
        // Deduct from main balance
        if (user.balance < amount) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }
        user.balance -= amount;
    }
    
    // Create transaction record
    const transaction = {
        id: generateId(),
        type: 'admin_deduction',
        userId: user.id,
        amount: amount,
        provider: provider || 'Bank',
        description: description || 'Admin fund deduction',
        status: 'completed',
        timestamp: getCurrentDate(),
        reference: 'ADMIN-' + generateId().substring(0, 8).toUpperCase()
    };
    transactions.push(transaction);
    
    // Send notification to user
    notifications.push({
        id: generateId(),
        userId: user.id,
        message: '💰 ' + formatCurrency(amount) + ' has been deducted from your account' + (provider ? ' (' + provider + ' wallet)' : '') + ' by Admin',
        type: 'system',
        read: false,
        createdAt: getCurrentDate()
    });
    
    console.log('✅ Admin deducted ' + formatCurrency(amount) + ' from user: ' + user.name);
    
    res.json({
        message: 'Funds deducted successfully',
        user: {
            id: user.id,
            name: user.name,
            balance: user.balance
        },
        wallet: provider ? mobileWallets.find(w => w.userId === userId && w.provider === provider) : null,
        transaction: transaction
    });
});

// ===== ADMIN: BULK ADD FUNDS =====
app.post('/api/admin/users/bulk-add-funds', authenticateAdmin, (req, res) => {
    const { userIds, amount, provider, description } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ error: 'User IDs array required' });
    }
    
    if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Valid amount required' });
    }
    
    const results = [];
    let totalAdded = 0;
    let failed = 0;
    
    userIds.forEach(userId => {
        const user = users.find(u => u.id === userId);
        if (user) {
            // Add to main balance
            user.balance += amount;
            
            // Add to specific wallet if provider specified
            if (provider) {
                let wallet = mobileWallets.find(w => w.userId === userId && w.provider === provider);
                if (!wallet) {
                    wallet = {
                        walletId: generateId(),
                        userId: user.id,
                        phoneNumber: user.phone,
                        provider: provider,
                        balance: 0,
                        currency: 'USD',
                        status: 'active',
                        createdAt: getCurrentDate()
                    };
                    mobileWallets.push(wallet);
                }
                wallet.balance += amount;
            }
            
            // Create transaction
            const transaction = {
                id: generateId(),
                type: 'admin_bulk_deposit',
                userId: user.id,
                amount: amount,
                provider: provider || 'Bank',
                description: description || 'Bulk admin fund addition',
                status: 'completed',
                timestamp: getCurrentDate(),
                reference: 'BULK-' + generateId().substring(0, 8).toUpperCase()
            };
            transactions.push(transaction);
            
            totalAdded++;
            results.push({ userId, name: user.name, status: 'success' });
        } else {
            failed++;
            results.push({ userId, status: 'failed', error: 'User not found' });
        }
    });
    
    console.log('✅ Admin bulk added ' + formatCurrency(amount) + ' to ' + totalAdded + ' users');
    
    res.json({
        message: 'Bulk fund addition completed',
        totalAdded: totalAdded,
        failed: failed,
        amountPerUser: amount,
        results: results
    });
});

// ===== ADMIN: UPDATE USER STATUS =====
app.put('/api/admin/users/status', authenticateAdmin, (req, res) => {
    const { userId, status } = req.body;
    
    if (!userId || !status) {
        return res.status(400).json({ error: 'User ID and status required' });
    }
    
    const user = users.find(u => u.id === userId);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    const validStatuses = ['active', 'suspended', 'frozen', 'closed'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Must be: ' + validStatuses.join(', ') });
    }
    
    user.status = status;
    
    notifications.push({
        id: generateId(),
        userId: user.id,
        message: '🔒 Your account status has been updated to: ' + status.toUpperCase(),
        type: 'system',
        read: false,
        createdAt: getCurrentDate()
    });
    
    res.json({
        message: 'User status updated successfully',
        user: {
            id: user.id,
            name: user.name,
            status: user.status
        }
    });
});

// ===== ADMIN: GET ALL TRANSACTIONS =====
app.get('/api/admin/transactions', authenticateAdmin, (req, res) => {
    const { limit, offset, type, userId } = req.query;
    
    let allTransactions = [...transactions];
    
    if (type) {
        allTransactions = allTransactions.filter(t => t.type === type);
    }
    
    if (userId) {
        allTransactions = allTransactions.filter(t => 
            t.userId === userId || t.senderId === userId || t.receiverId === userId
        );
    }
    
    const total = allTransactions.length;
    const start = parseInt(offset) || 0;
    const end = Math.min(start + (parseInt(limit) || 50), total);
    
    const paginated = allTransactions
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(start, end);
    
    res.json({
        transactions: paginated,
        total: total,
        start: start,
        end: end,
        stats: {
            totalAmount: allTransactions.reduce((sum, t) => sum + (t.amount || 0), 0),
            totalDeposits: allTransactions.filter(t => t.type === 'admin_deposit').reduce((sum, t) => sum + t.amount, 0),
            totalWithdrawals: allTransactions.filter(t => t.type === 'admin_deduction').reduce((sum, t) => sum + t.amount, 0)
        }
    });
});

// ===== ADMIN: DASHBOARD STATS =====
app.get('/api/admin/stats', authenticateAdmin, (req, res) => {
    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.status === 'active').length;
    const totalBalance = users.reduce((sum, u) => sum + u.balance, 0);
    const totalTransactions = transactions.length;
    const totalWallets = mobileWallets.length;
    const totalSavings = savingsGoals.reduce((sum, s) => sum + s.currentAmount, 0);
    const totalLoans = loans.reduce((sum, l) => sum + l.amount, 0);
    
    // Today's stats
    const today = new Date().toISOString().split('T')[0];
    const todayTransactions = transactions.filter(t => 
        new Date(t.timestamp).toISOString().split('T')[0] === today
    );
    const todayAmount = todayTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    
    // Provider distribution
    const providerDistribution = {};
    mobileWallets.forEach(w => {
        if (providerDistribution[w.provider]) {
            providerDistribution[w.provider] += w.balance;
        } else {
            providerDistribution[w.provider] = w.balance;
        }
    });
    
    // Recent activity
    const recentActivity = transactions
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 20);
    
    res.json({
        stats: {
            totalUsers: totalUsers,
            activeUsers: activeUsers,
            totalBalance: totalBalance,
            totalTransactions: totalTransactions,
            totalWallets: totalWallets,
            totalSavings: totalSavings,
            totalLoans: totalLoans,
            todayTransactions: todayTransactions.length,
            todayAmount: todayAmount
        },
        providerDistribution: providerDistribution,
        recentActivity: recentActivity
    });
});

// ===== ADMIN MIDDLEWARE =====
function authenticateAdmin(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }
    
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        if (decoded.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}
