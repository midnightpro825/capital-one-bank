// ===== MOBILE MONEY FUNCTIONALITY =====

// State
let currentUser = null;
let walletData = null;
let userTransactions = [];

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }
    
    // Load user data
    loadUserData();
    loadWallet();
    loadTransactions();
    generateReceiveCode();
});

// ===== LOAD DATA =====
async function loadUserData() {
    try {
        const userData = JSON.parse(localStorage.getItem('user'));
        if (userData) {
            currentUser = userData;
            document.getElementById('walletPhone').textContent = currentUser.phone || '+1 234 567 890';
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

async function loadWallet() {
    try {
        // For demo, create/retrieve wallet
        const response = await API.post('/mobile-money/wallet', {
            userId: currentUser?.id || 'demo-user'
        });
        
        walletData = response.wallet || response;
        updateWalletUI();
    } catch (error) {
        console.error('Error loading wallet:', error);
        // Show demo wallet
        showDemoWallet();
    }
}

function showDemoWallet() {
    document.getElementById('walletBalance').textContent = '$12,450.00';
    document.getElementById('walletProvider').textContent = 'MTN';
}

function updateWalletUI() {
    if (walletData) {
        document.getElementById('walletBalance').textContent = 
            formatCurrency(walletData.balance || 0);
        document.getElementById('walletProvider').textContent = 
            walletData.provider || 'MTN';
    }
}

async function loadTransactions() {
    try {
        const response = await API.get(`/transactions/${currentUser?.id || 'demo-user'}`);
        userTransactions = response.transactions || [];
        renderTransactions(userTransactions.slice(0, 5));
    } catch (error) {
        console.error('Error loading transactions:', error);
        // Show demo transactions
        showDemoTransactions();
    }
}

function showDemoTransactions() {
    const demoTransactions = [
        { id: 1, type: 'mobile_money', amount: 250, description: 'Sent to John Doe', timestamp: new Date(), status: 'completed' },
        { id: 2, type: 'mobile_money', amount: -500, description: 'Received from Sarah', timestamp: new Date(), status: 'completed' },
        { id: 3, type: 'airtime', amount: 20, description: 'Airtime Top-up (MTN)', timestamp: new Date(), status: 'completed' }
    ];
    renderTransactions(demoTransactions);
}

function renderTransactions(transactions) {
    const list = document.getElementById('transactionList');
    
    if (!transactions || transactions.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox" style="font-size: 48px; color: var(--text-light);"></i>
                <p>No transactions yet</p>
            </div>
        `;
        return;
    }
    
    list.innerHTML = transactions.map(t => {
        const isPositive = t.amount > 0;
        const icon = isPositive ? 'arrow-down' : 'arrow-up';
        const iconColor = isPositive ? '#2e7d32' : '#c62828';
        const amountClass = isPositive ? 'positive' : 'negative';
        const amount = isPositive ? `+${formatCurrency(t.amount)}` : formatCurrency(t.amount);
        const typeLabels = {
            'mobile_money': 'Mobile Money',
            'airtime': 'Airtime Purchase',
            'bill_payment': 'Bill Payment',
            'loan': 'Loan'
        };
        
        return `
            <div class="transaction-item">
                <div class="transaction-left">
                    <div class="transaction-icon" style="background: ${isPositive ? '#e8f5e9' : '#fce4ec'}; color: ${iconColor};">
                        <i class="fas fa-${icon}"></i>
                    </div>
                    <div class="transaction-info">
                        <p>${t.description || typeLabels[t.type] || 'Transaction'}</p>
                        <small>${new Date(t.timestamp).toLocaleString()}</small>
                    </div>
                </div>
                <div class="transaction-amount ${amountClass}">
                    ${amount}
                </div>
            </div>
        `;
    }).join('');
}

// ===== SEND MONEY =====
async function sendMoney(event) {
    event.preventDefault();
    
    const receiverPhone = document.getElementById('receiverPhone').value;
    const amount = parseFloat(document.getElementById('sendAmount').value);
    const description = document.getElementById('sendDescription').value;
    const pin = document.getElementById('sendPin').value;
    
    // Validation
    if (!receiverPhone || !amount || !pin) {
        showToast('Please fill all required fields', 'error');
        return;
    }
    
    if (amount <= 0) {
        showToast('Amount must be greater than 0', 'error');
        return;
    }
    
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
        showToast('PIN must be 4 digits', 'error');
        return;
    }
    
    try {
        const response = await API.post('/mobile-money/send', {
            userId: currentUser?.id || 'demo-user',
            receiverPhone,
            amount,
            pin,
            description: description || 'Money transfer'
        });
        
        showToast('Money sent successfully!', 'success');
        closeModal('sendModal');
        document.getElementById('sendForm').reset();
        
        // Update balance
        if (response.newBalance) {
            document.getElementById('walletBalance').textContent = formatCurrency(response.newBalance);
        }
        
        // Reload transactions
        loadTransactions();
        
    } catch (error) {
        showToast(error.message || 'Failed to send money', 'error');
    }
}

// ===== BUY AIRTIME =====
async function buyAirtime(event) {
    event.preventDefault();
    
    const phoneNumber = document.getElementById('airtimePhone').value;
    const network = document.getElementById('airtimeNetwork').value;
    const amount = parseFloat(document.getElementById('airtimeAmount').value);
    
    if (!phoneNumber || !amount) {
        showToast('Please fill all fields', 'error');
        return;
    }
    
    if (amount <= 0) {
        showToast('Amount must be greater than 0', 'error');
        return;
    }
    
    try {
        const response = await API.post('/mobile-money/airtime', {
            userId: currentUser?.id || 'demo-user',
            phoneNumber,
            network,
            amount
        });
        
        showToast(`$${amount} airtime purchased successfully for ${network}`, 'success');
        closeModal('airtimeModal');
        document.getElementById('airtimeForm').reset();
        
        // Update balance
        if (response.newBalance) {
            document.getElementById('walletBalance').textContent = formatCurrency(response.newBalance);
        }
        
        // Reload transactions
        loadTransactions();
        
    } catch (error) {
        showToast(error.message || 'Failed to purchase airtime', 'error');
    }
}

// ===== GENERATE RECEIVE CODE =====
function generateReceiveCode() {
    const code = Math.floor(100000 + Math.random() * 900000);
    document.getElementById('receiveCode').textContent = code;
}

function copyReceiveCode() {
    const code = document.getElementById('receiveCode').textContent;
    navigator.clipboard.writeText(code).then(() => {
        showToast('Code copied to clipboard!', 'success');
    }).catch(() => {
        // Fallback
        const textArea = document.createElement('textarea');
        textArea.value = code;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showToast('Code copied to clipboard!', 'success');
    });
}

// ===== MODAL FUNCTIONS =====
function showModal(modalId) {
    document.getElementById(modalId).classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
    document.body.style.overflow = 'auto';
}

// Close modal when clicking outside
document.addEventListener('click', function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('show');
        document.body.style.overflow = 'auto';
    }
});

// ===== LOGOUT =====
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login.html';
}

// ===== EXPOSE FUNCTIONS =====
window.sendMoney = sendMoney;
window.buyAirtime = buyAirtime;
window.showModal = showModal;
window.closeModal = closeModal;
window.logout = logout;
window.copyReceiveCode = copyReceiveCode;