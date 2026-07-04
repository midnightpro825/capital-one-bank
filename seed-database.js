const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const db = new sqlite3.Database('banking.db');

// ===== SEED DATA =====
const firstNames = ['James','Mary','John','Patricia','Robert','Jennifer','Michael','Linda','William','Elizabeth','David','Barbara','Richard','Susan','Joseph','Jessica','Thomas','Sarah','Charles','Karen','Christopher','Nancy','Daniel','Lisa','Matthew','Betty','Anthony','Helen','Mark','Sandra','Donald','Donna','Steven','Carol','Paul','Ruth','Andrew','Sharon','Joshua','Michelle','Kenneth','Laura','Kevin','Sarah','Brian','Kimberly','George','Deborah','Timothy','Linda','Ronald','Patricia','Edward','Susan','Jason','Margaret','Jeffrey','Dorothy','Ryan','Lisa','Jacob','Nancy','Gary','Karen','Nicholas','Betty','Eric','Helen','Jonathan','Sandra','Stephen','Donna','Larry','Carol','Justin','Ruth','Scott','Sharon','Brandon','Michelle','Benjamin','Laura','Samuel','Sarah','Raymond','Kimberly','Gregory','Deborah','Frank','Jessica','Alexander','Shirley','Patrick','Cynthia','Jack','Angela','Dennis','Melissa','Jerry','Brenda','Tyler','Amy','Aaron','Anna','Jose','Rebecca','Nathan','Virginia','Adam','Kathleen','Henry','Pamela','Zachary','Martha','Tiffany','Amanda','Christian','Stephanie','Dylan','Carolyn','Ethan','Christine','Noah','Marie','Liam','Janet','Mason','Catherine','Logan','Frances','Oliver','Ann','Elijah','Joyce','Carter','Diane'];
const lastNames = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin','Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson','Walker','Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores','Green','Adams','Nelson','Baker','Hall','Rivera','Campbell','Mitchell','Carter','Roberts','Turner','Phillips','Evans','Collins','Edwards','Stewart','Morris','Murphy','Cook','Rogers','Morgan','Peterson','Cooper','Reed','Bailey','Bell','Howard','Ward','Cox','Diaz','Richardson','Wood','Watson','Brooks','Bennett','Gray','James','Reyes','Cruz','Hughes','Price','Myers','Long','Foster','Sanders','Ross','Powell','Sullivan','Russell','Ortiz','Jenkins','Perry','Butler','Barnes','Fisher','Henderson','Coleman','Simmons','Patterson','Jordan','Reynolds','Hamilton','Graham','Kim','Gonzales','Alexander','Ramos','Wallace','Griffin','West','Cole','Hayes','Chavez'];
const providers = ['MTN', 'Airtel', 'Vodafone', 'Tigo'];
const statuses = ['active', 'active', 'active', 'active', 'active', 'suspended', 'frozen'];
const tiers = ['Bronze', 'Silver', 'Gold', 'Platinum'];
const countries = ['USA','UK','Canada','Australia','Nigeria','Kenya','South Africa','Ghana','India','UAE'];
const cities = ['New York','London','Toronto','Sydney','Lagos','Nairobi','Cape Town','Accra','Mumbai','Dubai'];

function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomNumber(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomFloat(min, max) { return parseFloat((Math.random() * (max - min) + min).toFixed(2)); }
function randomDate(start, end) { return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())); }
function generatePhone() { const countryCode = randomItem(['+1','+44','+61','+234','+254','+27','+233','+91','+971']); const number = randomNumber(100000000, 999999999); return countryCode + ' ' + number.toString().replace(/(\d{3})(\d{3})(\d{4})/, '  '); }
function generateEmail(firstName, lastName) { const domains = ['gmail.com','yahoo.com','outlook.com','hotmail.com','icloud.com','protonmail.com','example.com']; return firstName.toLowerCase() + '.' + lastName.toLowerCase() + randomNumber(1, 999) + '@' + randomItem(domains); }

console.log('📊 Creating database tables...');

// Create tables
db.run('CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, phone TEXT NOT NULL, password TEXT NOT NULL, balance REAL DEFAULT 1000, pin TEXT DEFAULT "1234", status TEXT DEFAULT "active", tier TEXT DEFAULT "Bronze", loyaltyPoints INTEGER DEFAULT 0, cashbackRate REAL DEFAULT 0.01, dailyLimit REAL DEFAULT 2000, monthlyLimit REAL DEFAULT 10000, kycVerified INTEGER DEFAULT 0, kycSubmitted INTEGER DEFAULT 0, address TEXT, dob TEXT, gender TEXT, profilePicture TEXT, twoFactor TEXT DEFAULT "disabled", sessionTimeout INTEGER DEFAULT 30, createdAt TEXT NOT NULL, lastLogin TEXT)');
db.run('CREATE TABLE IF NOT EXISTS mobile_wallets (walletId TEXT PRIMARY KEY, userId TEXT NOT NULL, phoneNumber TEXT NOT NULL, provider TEXT NOT NULL, balance REAL DEFAULT 0, currency TEXT DEFAULT "USD", status TEXT DEFAULT "active", createdAt TEXT NOT NULL, FOREIGN KEY (userId) REFERENCES users(id))');
db.run('CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, type TEXT NOT NULL, userId TEXT NOT NULL, senderId TEXT, receiverId TEXT, senderPhone TEXT, receiverPhone TEXT, provider TEXT, amount REAL NOT NULL, description TEXT, status TEXT DEFAULT "completed", timestamp TEXT NOT NULL, reference TEXT, FOREIGN KEY (userId) REFERENCES users(id))');
db.run('CREATE TABLE IF NOT EXISTS savings_goals (id TEXT PRIMARY KEY, userId TEXT NOT NULL, goal TEXT NOT NULL, targetAmount REAL NOT NULL, currentAmount REAL DEFAULT 0, deadline TEXT, autoSave INTEGER DEFAULT 0, status TEXT DEFAULT "active", createdAt TEXT NOT NULL, progress REAL DEFAULT 0, FOREIGN KEY (userId) REFERENCES users(id))');
db.run('CREATE TABLE IF NOT EXISTS loans (id TEXT PRIMARY KEY, userId TEXT NOT NULL, amount REAL NOT NULL, purpose TEXT, duration INTEGER DEFAULT 12, interestRate REAL DEFAULT 0.10, totalRepayment REAL NOT NULL, monthlyPayment REAL NOT NULL, remainingBalance REAL NOT NULL, status TEXT DEFAULT "active", disbursed INTEGER DEFAULT 1, createdAt TEXT NOT NULL, nextPaymentDate TEXT, FOREIGN KEY (userId) REFERENCES users(id))');
db.run('CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, userId TEXT NOT NULL, message TEXT NOT NULL, type TEXT DEFAULT "system", read INTEGER DEFAULT 0, createdAt TEXT NOT NULL, FOREIGN KEY (userId) REFERENCES users(id))');

console.log('✅ Tables created!');

console.log('👤 Seeding 2000 users...');
const count = 2000;
const users = [];
const wallets = [];
const transactions = [];
const savings = [];
const loans = [];
const notifications = [];
const startDate = new Date('2024-01-01');
const endDate = new Date();

for (let i = 0; i < count; i++) {
    const firstName = randomItem(firstNames);
    const lastName = randomItem(lastNames);
    const name = firstName + ' ' + lastName;
    const email = generateEmail(firstName, lastName);
    const phone = generatePhone();
    const password = bcrypt.hashSync('password123', 10);
    const balance = randomFloat(100, 50000);
    const tier = randomItem(tiers);
    const status = randomItem(statuses);
    const createdAt = randomDate(startDate, endDate).toISOString();
    const lastLogin = randomDate(new Date(createdAt), endDate).toISOString();
    const kycVerified = Math.random() > 0.3 ? 1 : 0;
    const address = randomNumber(1, 9999) + ' ' + randomItem(['Main','Oak','Maple','Cedar','Pine','Elm','Washington','Lincoln']) + ' St, ' + randomItem(cities) + ', ' + randomItem(countries);
    const dob = randomDate(new Date('1950-01-01'), new Date('2005-12-31')).toISOString().split('T')[0];
    const gender = randomItem(['Male', 'Female', 'Other']);
    const loyaltyPoints = randomNumber(0, 15000);
    const dailyLimit = randomNumber(1000, 5000);
    const monthlyLimit = randomNumber(5000, 25000);

    const user = {
        id: uuidv4(), name: name, email: email, phone: phone, password: password, balance: balance,
        pin: '1234', status: status, tier: tier, loyaltyPoints: loyaltyPoints,
        cashbackRate: tier === 'Platinum' ? 0.05 : tier === 'Gold' ? 0.03 : tier === 'Silver' ? 0.02 : 0.01,
        dailyLimit: dailyLimit, monthlyLimit: monthlyLimit, kycVerified: kycVerified,
        kycSubmitted: kycVerified || Math.random() > 0.4 ? 1 : 0,
        address: address, dob: dob, gender: gender, profilePicture: null,
        twoFactor: Math.random() > 0.7 ? randomItem(['sms','email','authenticator']) : 'disabled',
        sessionTimeout: randomNumber(15, 60),
        createdAt: createdAt, lastLogin: lastLogin
    };

    users.push(user);

    providers.forEach(function(provider) {
        wallets.push({
            walletId: uuidv4(), userId: user.id, phoneNumber: phone,
            provider: provider, balance: randomFloat(0, 2000),
            currency: 'USD', status: 'active', createdAt: createdAt
        });
    });

    const numTransactions = randomNumber(3, 15);
    for (let j = 0; j < numTransactions; j++) {
        const type = randomItem(['sent','received','airtime','bill','savings']);
        const amount = randomFloat(5, 500);
        const provider = randomItem(providers);
        const timestamp = randomDate(new Date(createdAt), new Date()).toISOString();
        let senderId, receiverId, senderPhone, receiverPhone;
        if (type === 'received') {
            senderId = uuidv4(); receiverId = user.id;
            senderPhone = generatePhone(); receiverPhone = phone;
        } else if (type === 'sent') {
            senderId = user.id; receiverId = uuidv4();
            senderPhone = phone; receiverPhone = generatePhone();
        } else {
            senderId = user.id; receiverId = null;
            senderPhone = phone; receiverPhone = null;
        }
        transactions.push({
            id: uuidv4(), type: type, userId: user.id,
            senderId: senderId, receiverId: receiverId, senderPhone: senderPhone, receiverPhone: receiverPhone,
            provider: type === 'airtime' || type === 'bill' ? provider : null,
            amount: amount, description: 'Sample ' + type + ' transaction ' + (j+1),
            status: Math.random() > 0.9 ? 'pending' : 'completed',
            timestamp: timestamp, reference: 'TX-' + uuidv4().substring(0, 8).toUpperCase()
        });
    }

    if (Math.random() > 0.7) {
        const goalTypes = ['Vacation Fund','Emergency Fund','Car Fund','House Deposit','Education Fund','Retirement Fund'];
        const targetAmount = randomFloat(1000, 20000);
        const currentAmount = randomFloat(0, targetAmount);
        const deadline = new Date();
        deadline.setFullYear(deadline.getFullYear() + randomNumber(1, 5));
        savings.push({
            id: uuidv4(), userId: user.id, goal: randomItem(goalTypes),
            targetAmount: targetAmount, currentAmount: currentAmount, deadline: deadline.toISOString(),
            autoSave: Math.random() > 0.7 ? 1 : 0,
            status: currentAmount >= targetAmount ? 'completed' : 'active',
            createdAt: randomDate(new Date(createdAt), endDate).toISOString(),
            progress: (currentAmount / targetAmount) * 100
        });
    }

    if (Math.random() > 0.8) {
        const loanAmount = randomFloat(500, 10000);
        const duration = randomItem([6, 12, 24, 36]);
        const interestRate = 0.10;
        const totalRepayment = loanAmount * (1 + interestRate);
        const monthlyPayment = totalRepayment / duration;
        const remainingBalance = randomFloat(0, totalRepayment);
        loans.push({
            id: uuidv4(), userId: user.id, amount: loanAmount,
            purpose: randomItem(['Personal Loan','Business Loan','Education Loan','Home Improvement','Debt Consolidation']),
            duration: duration, interestRate: interestRate, totalRepayment: totalRepayment, monthlyPayment: monthlyPayment,
            remainingBalance: remainingBalance, status: remainingBalance <= 0 ? 'completed' : 'active',
            disbursed: 1,
            createdAt: randomDate(new Date(createdAt), endDate).toISOString(),
            nextPaymentDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        });
    }

    const numNotifications = randomNumber(2, 5);
    const notificationMessages = ['Welcome to the platform!','Your transaction was successful','New promotion available','You earned loyalty points','Your savings goal is on track','Payment received','Security alert: new login detected','Your KYC was approved','Loan application approved','Cashback credited to your account'];
    for (let j = 0; j < numNotifications; j++) {
        notifications.push({
            id: uuidv4(), userId: user.id,
            message: randomItem(notificationMessages) + ' #' + (j+1),
            type: randomItem(['transaction','system','promotion','achievement']),
            read: Math.random() > 0.6 ? 1 : 0,
            createdAt: randomDate(new Date(createdAt), new Date()).toISOString()
        });
    }

    if (i % 100 === 0) console.log('   Progress: ' + i + '/' + count + ' users created');
}

console.log('💾 Inserting data into database...');

db.serialize(function() {
    db.run('BEGIN TRANSACTION');
    
    var insertUser = db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    users.forEach(function(u) { insertUser.run(u.id,u.name,u.email,u.phone,u.password,u.balance,u.pin,u.status,u.tier,u.loyaltyPoints,u.cashbackRate,u.dailyLimit,u.monthlyLimit,u.kycVerified,u.kycSubmitted,u.address,u.dob,u.gender,u.profilePicture,u.twoFactor,u.sessionTimeout,u.createdAt,u.lastLogin); });
    
    var insertWallet = db.prepare('INSERT INTO mobile_wallets VALUES (?,?,?,?,?,?,?,?)');
    wallets.forEach(function(w) { insertWallet.run(w.walletId,w.userId,w.phoneNumber,w.provider,w.balance,w.currency,w.status,w.createdAt); });
    
    var insertTx = db.prepare('INSERT INTO transactions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
    transactions.forEach(function(t) { insertTx.run(t.id,t.type,t.userId,t.senderId,t.receiverId,t.senderPhone,t.receiverPhone,t.provider,t.amount,t.description,t.status,t.timestamp,t.reference); });
    
    var insertSavings = db.prepare('INSERT INTO savings_goals VALUES (?,?,?,?,?,?,?,?,?,?)');
    savings.forEach(function(s) { insertSavings.run(s.id,s.userId,s.goal,s.targetAmount,s.currentAmount,s.deadline,s.autoSave,s.status,s.createdAt,s.progress); });
    
    var insertLoan = db.prepare('INSERT INTO loans VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
    loans.forEach(function(l) { insertLoan.run(l.id,l.userId,l.amount,l.purpose,l.duration,l.interestRate,l.totalRepayment,l.monthlyPayment,l.remainingBalance,l.status,l.disbursed,l.createdAt,l.nextPaymentDate); });
    
    var insertNotif = db.prepare('INSERT INTO notifications VALUES (?,?,?,?,?,?)');
    notifications.forEach(function(n) { insertNotif.run(n.id,n.userId,n.message,n.type,n.read,n.createdAt); });
    
    db.run('COMMIT');
});

console.log('✅ Database seeded successfully!');
console.log('   👤 Users: ' + users.length);
console.log('   💳 Wallets: ' + wallets.length);
console.log('   📊 Transactions: ' + transactions.length);
console.log('   🎯 Savings Goals: ' + savings.length);
console.log('   💰 Loans: ' + loans.length);
console.log('   🔔 Notifications: ' + notifications.length);

db.all('SELECT COUNT(*) as total FROM users', function(err, rows) {
    if (err) { console.error(err); db.close(); return; }
    console.log('\n📊 SUMMARY:');
    console.log('   Total Users: ' + rows[0].total);
    
    db.all('SELECT tier, COUNT(*) as count FROM users GROUP BY tier', function(err, tiers) {
        if (err) { console.error(err); db.close(); return; }
        console.log('   Tier Distribution:');
        tiers.forEach(function(t) { console.log('      ' + t.tier + ': ' + t.count); });
    });
    
    db.all('SELECT status, COUNT(*) as count FROM users GROUP BY status', function(err, statuses) {
        if (err) { console.error(err); db.close(); return; }
        console.log('   Status Distribution:');
        statuses.forEach(function(s) { console.log('      ' + s.status + ': ' + s.count); });
    });
    
    db.all('SELECT provider, SUM(balance) as total FROM mobile_wallets GROUP BY provider', function(err, providers) {
        if (err) { console.error(err); db.close(); return; }
        console.log('   Wallet Distribution:');
        providers.forEach(function(p) { console.log('      ' + p.provider + ': $' + p.total.toFixed(2)); });
        db.close();
        console.log('\n✅ Seed complete! Database is ready.');
    });
});
