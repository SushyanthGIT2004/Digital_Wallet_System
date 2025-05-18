const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const path = require('path');
const config = require('../config');

// Load environment variables
dotenv.config();

// Import database and models
const { sequelize } = require('./models/index');

// Initialize express app
const app = express();
const PORT = config.server.port;

// Test the database connection
console.log('Attempting to connect to SQLite database...');
sequelize.authenticate()
  .then(() => {
    console.log('Connected to SQLite database');
    return sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
  })
  .then(() => {
    console.log('Database tables synchronized');
  })
  .catch(err => {
    console.error('SQLite database connection error:', err);
    console.log('\nTo fix this error, make sure the application has write permissions to create the SQLite database file.');
  });

// Apply security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"]
    }
  }
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', limiter);

// Define temporary API routes for frontend testing
// Auth routes
app.post('/api/auth/register', (req, res) => {
  res.json({ 
    message: 'Registration successful',
    user: { id: 1, username: req.body.username, email: req.body.email },
    token: 'test-token-123'
  });
});

app.post('/api/auth/login', (req, res) => {
  res.json({ 
    message: 'Login successful',
    user: { id: 1, username: 'testuser', email: req.body.email },
    token: 'test-token-123'
  });
});

// Wallet routes
app.get('/api/wallet', (req, res) => {
  res.json({ 
    message: 'Wallet retrieved',
    wallet: { 
      id: 1, 
      userId: 1, 
      balance: 1000.00,
      currency: 'USD',
      isActive: true,
      lastTransaction: new Date().toISOString()
    }
  });
});

app.post('/api/wallet/deposit', (req, res) => {
  res.json({ 
    message: 'Deposit successful',
    transaction: {
      id: Math.floor(Math.random() * 1000),
      amount: req.body.amount,
      type: 'deposit',
      status: 'completed',
      createdAt: new Date().toISOString()
    }
  });
});

app.post('/api/wallet/withdraw', (req, res) => {
  res.json({ 
    message: 'Withdrawal successful',
    transaction: {
      id: Math.floor(Math.random() * 1000),
      amount: req.body.amount,
      type: 'withdrawal',
      status: 'completed',
      createdAt: new Date().toISOString()
    }
  });
});

app.post('/api/wallet/transfer', (req, res) => {
  res.json({ 
    message: 'Transfer successful',
    transaction: {
      id: Math.floor(Math.random() * 1000),
      amount: req.body.amount,
      type: 'transfer',
      recipientEmail: req.body.recipientEmail,
      description: req.body.description || '',
      status: 'completed',
      createdAt: new Date().toISOString()
    }
  });
});

// Transaction routes
app.get('/api/transactions', (req, res) => {
  res.json({ 
    message: 'Transactions retrieved',
    transactions: [
      {
        id: 101,
        type: 'deposit',
        amount: 500,
        currency: 'USD',
        status: 'completed',
        createdAt: new Date().toISOString(),
        sender: { id: 1, username: 'testuser' }
      },
      {
        id: 102,
        type: 'withdrawal',
        amount: 200,
        currency: 'USD',
        status: 'completed',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        sender: { id: 1, username: 'testuser' }
      },
      {
        id: 103,
        type: 'transfer',
        amount: 150,
        currency: 'USD',
        status: 'completed',
        createdAt: new Date(Date.now() - 172800000).toISOString(),
        sender: { id: 1, username: 'testuser' },
        recipient: { id: 2, username: 'otheruser' },
        description: 'Payment for services'
      }
    ]
  });
});

// API Root route
app.get('/api', (req, res) => {
  res.json({ 
    message: 'Welcome to Digital Wallet API',
    status: sequelize.connectionManager.hasOwnProperty('hasConnection') ? 'Database connected' : 'Database disconnected'
  });
});

// Frontend route - send index.html for all non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.resolve(__dirname, '../public/index.html'));
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Frontend available at http://localhost:${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
});

module.exports = app; // For testing purposes
