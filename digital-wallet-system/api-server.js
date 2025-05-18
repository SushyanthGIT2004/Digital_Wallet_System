const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { detectFraud } = require('./src/utils/fraudDetection');
const { sendSecurityAlert, sendLargeTransactionAlert } = require('./src/utils/emailService');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'your_secret_key'; // In production, use environment variables

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Database connection
const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) {
    console.error('Database connection error:', err.message);
  } else {
    console.log('Connected to SQLite database');
  }
});

// API Routes
app.post('/api/auth/register', (req, res) => {
  const { username, email, password } = req.body;
  
  if (!username || !email || !password) {
    return res.status(400).json({ 
      success: false, 
      message: 'Please provide username, email and password' 
    });
  }
  
  // Check if user already exists
  db.get('SELECT * FROM Users WHERE email = ?', [email], (err, user) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    
    if (user) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }
    
    // Hash the password
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);
    
    const now = new Date().toISOString();
    
    // Insert new user
    db.run(
      'INSERT INTO Users (username, email, password, role, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [username, email, hashedPassword, 'user', 1, now, now],
      function(err) {
        if (err) {
          return res.status(500).json({ success: false, message: err.message });
        }
        
        const userId = this.lastID;
        
        // Create wallet for new user
        db.run(
          'INSERT INTO Wallets (userId, balance, currency, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
          [userId, 75000, 'INR', 1, now, now],
          function(err) {
            if (err) {
              return res.status(500).json({ success: false, message: err.message });
            }
            
            // Generate JWT token
            const token = jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '1d' });
            
            res.status(201).json({
              success: true,
              message: 'Registration successful',
              user: { id: userId, username, email },
              token
            });
          }
        );
      }
    );
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Please provide email and password' });
  }
  
  // Find user
  db.get('SELECT * FROM Users WHERE email = ?', [email], (err, user) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    // Verify password
    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    // Update last login
    const now = new Date().toISOString();
    db.run('UPDATE Users SET lastLogin = ?, updatedAt = ? WHERE id = ?', [now, now, user.id]);
    
    // Generate JWT token
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '1d' });
    
    res.json({
      success: true,
      message: 'Login successful',
      user: { id: user.id, username: user.username, email: user.email },
      token
    });
  });
});

// Protected route middleware
const protect = (req, res, next) => {
  let token;
  
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  
  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    db.get('SELECT id, username, email, role FROM Users WHERE id = ?', [decoded.id], (err, user) => {
      if (err || !user) {
        return res.status(401).json({ success: false, message: 'Not authorized' });
      }
      
      req.user = user;
      next();
    });
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Not authorized' });
  }
};

// Get wallet details
app.get('/api/wallet', protect, (req, res) => {
  db.get('SELECT * FROM Wallets WHERE userId = ?', [req.user.id], (err, wallet) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }
    
    res.json({
      success: true,
      wallet: {
        id: wallet.id,
        balance: wallet.balance,
        currency: wallet.currency,
        isActive: wallet.isActive === 1
      }
    });
  });
});

// Transaction endpoints

// Deposit funds
app.post('/api/wallet/deposit', protect, (req, res) => {
  const { amount } = req.body;
  
  if (!amount || amount <= 0) {
    return res.status(400).json({ success: false, message: 'Please enter a valid amount' });
  }
  
  const now = new Date().toISOString();
  
  // Start a transaction
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    // Update wallet balance
    db.run(
      'UPDATE Wallets SET balance = balance + ?, lastTransaction = ?, updatedAt = ? WHERE userId = ?',
      [amount, now, now, req.user.id],
      function(err) {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ success: false, message: err.message });
        }
        
        if (this.changes === 0) {
          db.run('ROLLBACK');
          return res.status(404).json({ success: false, message: 'Wallet not found' });
        }
        
        // Create transaction record
        db.run(
          `INSERT INTO Transactions 
           (senderId, amount, currency, type, status, createdAt, updatedAt) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [req.user.id, amount, 'INR', 'deposit', 'completed', now, now],
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              return res.status(500).json({ success: false, message: err.message });
            }
            
            const transactionId = this.lastID;
            
            // Get updated wallet
            db.get('SELECT * FROM Wallets WHERE userId = ?', [req.user.id], (err, wallet) => {
              if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ success: false, message: err.message });
              }
              
              // Commit transaction
              db.run('COMMIT');
              
              res.json({
                success: true,
                message: 'Amount credited successfully',
                transaction: {
                  id: transactionId,
                  type: 'deposit',
                  amount: amount,
                  currency: 'INR',
                  status: 'completed',
                  createdAt: now
                },
                wallet: {
                  balance: wallet.balance,
                  currency: wallet.currency
                }
              });
            });
          }
        );
      }
    );
  });
});

// Withdraw funds
app.post('/api/wallet/withdraw', protect, (req, res) => {
  const { amount } = req.body;
  
  if (!amount || amount <= 0) {
    return res.status(400).json({ success: false, message: 'Please enter a valid amount' });
  }
  
  // Check if wallet has sufficient balance
  db.get('SELECT * FROM Wallets WHERE userId = ?', [req.user.id], (err, wallet) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }
    
    if (wallet.balance < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }
    
    // Create transaction object for fraud check
    const transaction = {
      type: 'withdrawal',
      amount: amount,
      senderId: req.user.id
    };
    
    // Check for fraud
    detectFraud(transaction, req.user.id, db)
      .then(fraudCheck => {
        if (fraudCheck.isFraudulent) {
          // Send security alert email for fraudulent transaction
          db.get('SELECT * FROM Users WHERE id = ?', [req.user.id], (err, user) => {
            if (!err && user) {
              sendSecurityAlert(
                { ...transaction, timestamp: new Date().toISOString() },
                { username: user.username, email: user.email },
                fraudCheck.reasons.join('; ')
              ).catch(err => console.error('Error sending security alert:', err));
            }
          });
          
          return res.status(400).json({
            success: false,
            message: 'Transaction flagged for suspicious activity',
            details: {
              fraudScore: fraudCheck.fraudScore,
              reasons: fraudCheck.reasons
            }
          });
        }
        
        // If this is a large withdrawal, send an alert even if not fraudulent
        if (fraudCheck.isLargeTransaction) {
          db.get('SELECT * FROM Users WHERE id = ?', [req.user.id], (err, user) => {
            if (!err && user) {
              console.log(`Sending email alert to ${user.email} for large withdrawal`);
              sendLargeTransactionAlert(
                { 
                  ...transaction, 
                  timestamp: new Date().toISOString()
                },
                { username: user.username, email: user.email }
              ).catch(err => console.error('Error sending large transaction alert:', err));
            }
          });
        }
        
        // If no fraud is detected, process the withdrawal
        const now = new Date().toISOString();
        
        // Start a transaction
        db.serialize(() => {
          db.run('BEGIN TRANSACTION');
          
          // Update wallet balance
          db.run(
            'UPDATE Wallets SET balance = balance - ?, lastTransaction = ?, updatedAt = ? WHERE userId = ?',
            [amount, now, now, req.user.id],
            function(err) {
              if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ success: false, message: err.message });
              }
              
              // Create transaction record with fraud score
              db.run(
                `INSERT INTO Transactions 
                 (senderId, amount, currency, type, status, fraudScore, createdAt, updatedAt) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [req.user.id, amount, 'INR', 'withdrawal', 'completed', fraudCheck.fraudScore, now, now],
                function(err) {
                  if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ success: false, message: err.message });
                  }
                  
                  const transactionId = this.lastID;
                  
                  // Get updated wallet
                  db.get('SELECT * FROM Wallets WHERE userId = ?', [req.user.id], (err, updatedWallet) => {
                    if (err) {
                      db.run('ROLLBACK');
                      return res.status(500).json({ success: false, message: err.message });
                    }
                    
                    // Commit transaction
                    db.run('COMMIT');
                    
                    res.json({
                      success: true,
                      message: 'Amount debited successfully',
                      transaction: {
                        id: transactionId,
                        type: 'withdrawal',
                        amount: amount,
                        currency: 'INR',
                        status: 'completed',
                        fraudScore: fraudCheck.fraudScore,
                        createdAt: now
                      },
                      wallet: {
                        balance: updatedWallet.balance,
                        currency: updatedWallet.currency
                      }
                    });
                  });
                }
              );
            }
          );
        });
      })
      .catch(error => {
        console.error('Fraud detection error:', error);
        res.status(500).json({ success: false, message: 'Error processing request' });
      });
  });
});

// Transfer funds
app.post('/api/wallet/transfer', protect, (req, res) => {
  const { recipientEmail, amount, description } = req.body;
  
  if (!recipientEmail) {
    return res.status(400).json({ success: false, message: 'Please provide recipient email' });
  }
  
  if (!amount || amount <= 0) {
    return res.status(400).json({ success: false, message: 'Please enter a valid amount' });
  }
  
  console.log(`Transfer request: ${req.user.email} to ${recipientEmail}, amount: ${amount}`);
  
  // Find recipient
  db.get('SELECT * FROM Users WHERE email = ?', [recipientEmail], (err, recipient) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ success: false, message: 'Database error occurred' });
    }
    
    // If recipient doesn't exist, create a new one with a random ID
    if (!recipient) {
      const now = new Date().toISOString();
      const username = recipientEmail.split('@')[0]; // Use part before @ for username
      const randomPassword = Math.random().toString(36).substring(2, 10); // Generate random password
      const hashedPassword = bcrypt.hashSync(randomPassword, 10);
      
      console.log(`Creating new recipient for ${recipientEmail}`);
      
      // Insert new user
      db.run(
        'INSERT INTO Users (username, email, password, role, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [username, recipientEmail, hashedPassword, 'user', 1, now, now],
        function(err) {
          if (err) {
            console.error('Error creating recipient:', err);
            return res.status(500).json({ success: false, message: 'Error creating recipient account' });
          }
          
          const recipientId = this.lastID;
          
          // Create wallet for new recipient
          db.run(
            'INSERT INTO Wallets (userId, balance, currency, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
            [recipientId, 0, 'INR', 1, now, now],
            function(err) {
              if (err) {
                console.error('Error creating recipient wallet:', err);
                return res.status(500).json({ success: false, message: 'Error creating recipient wallet' });
              }
              
              // Now that we created the recipient, proceed with the transfer
              processTransfer(req, res, {
                id: recipientId, 
                username: username, 
                email: recipientEmail
              }, amount, description);
            }
          );
        }
      );
    } else {
      // Recipient exists, proceed with the transfer
      if (recipient.id === req.user.id) {
        return res.status(400).json({ success: false, message: 'Cannot transfer to yourself' });
      }
      
      processTransfer(req, res, recipient, amount, description);
    }
  });
});

// Helper function to process transfers 
function processTransfer(req, res, recipient, amount, description) {
  // Check if sender's wallet has sufficient balance
  db.get('SELECT * FROM Wallets WHERE userId = ?', [req.user.id], (err, senderWallet) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ success: false, message: 'Error accessing wallet' });
    }
    
    if (!senderWallet) {
      return res.status(404).json({ success: false, message: 'Your wallet not found' });
    }
    
    if (senderWallet.balance < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }
    
    // Check if recipient has a wallet
    db.get('SELECT * FROM Wallets WHERE userId = ?', [recipient.id], (err, recipientWallet) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ success: false, message: 'Error accessing recipient wallet' });
      }
      
      if (!recipientWallet) {
        return res.status(404).json({ success: false, message: 'Recipient wallet not found' });
      }
      
      // Create transaction object for fraud check
      const transaction = {
        type: 'transfer',
        amount: amount,
        senderId: req.user.id,
        recipientId: recipient.id
      };
      
      // Check for fraud
      detectFraud(transaction, req.user.id, db)
        .then(fraudCheck => {
          if (fraudCheck.isFraudulent) {
            // Send security alert email for fraudulent transaction
            db.get('SELECT * FROM Users WHERE id = ?', [req.user.id], (err, user) => {
              if (!err && user) {
                sendSecurityAlert(
                  { ...transaction, timestamp: new Date().toISOString() },
                  { username: user.username, email: user.email },
                  fraudCheck.reasons.join('; ')
                ).catch(err => console.error('Error sending security alert:', err));
              }
            });
            
            return res.status(400).json({
              success: false,
              message: 'Transaction flagged for suspicious activity',
              details: {
                fraudScore: fraudCheck.fraudScore,
                reasons: fraudCheck.reasons
              }
            });
          }
          
          // If this is a large transfer, send an alert even if not fraudulent
          if (fraudCheck.isLargeTransaction) {
            db.get('SELECT * FROM Users WHERE id = ?', [req.user.id], (err, user) => {
              if (!err && user) {
                console.log(`Sending email alert to ${user.email} for large transfer to ${recipient.email}`);
                sendLargeTransactionAlert(
                  { 
                    ...transaction, 
                    timestamp: new Date().toISOString(),
                    description: description || ''
                  },
                  { username: user.username, email: user.email },
                  { username: recipient.username, email: recipient.email }
                ).catch(err => console.error('Error sending large transaction alert:', err));
              }
            });
          }
          
          // If no fraud is detected, process the transfer
          const now = new Date().toISOString();
          
          // Start a transaction
          db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            
            // Deduct from sender's wallet
            db.run(
              'UPDATE Wallets SET balance = balance - ?, lastTransaction = ?, updatedAt = ? WHERE userId = ?',
              [amount, now, now, req.user.id],
              function(err) {
                if (err) {
                  console.error('Transaction error:', err);
                  db.run('ROLLBACK');
                  return res.status(500).json({ success: false, message: 'Error processing transaction' });
                }
                
                // Add to recipient's wallet
                db.run(
                  'UPDATE Wallets SET balance = balance + ?, lastTransaction = ?, updatedAt = ? WHERE userId = ?',
                  [amount, now, now, recipient.id],
                  function(err) {
                    if (err) {
                      console.error('Transaction error:', err);
                      db.run('ROLLBACK');
                      return res.status(500).json({ success: false, message: 'Error completing transaction' });
                    }
                    
                    // Create transaction record with fraud score
                    db.run(
                      `INSERT INTO Transactions 
                       (senderId, recipientId, amount, currency, type, status, description, fraudScore, createdAt, updatedAt) 
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                      [req.user.id, recipient.id, amount, 'INR', 'transfer', 'completed', description || '', fraudCheck.fraudScore, now, now],
                      function(err) {
                        if (err) {
                          console.error('Transaction error:', err);
                          db.run('ROLLBACK');
                          return res.status(500).json({ success: false, message: 'Error recording transaction' });
                        }
                        
                        const transactionId = this.lastID;
                        
                        // Get updated sender wallet
                        db.get('SELECT * FROM Wallets WHERE userId = ?', [req.user.id], (err, updatedSenderWallet) => {
                          if (err) {
                            console.error('Database error:', err);
                            db.run('ROLLBACK');
                            return res.status(500).json({ success: false, message: 'Error retrieving updated wallet' });
                          }
                          
                          // Commit transaction
                          db.run('COMMIT');
                          
                          console.log(`Transfer successful: ${req.user.email} to ${recipient.email}, amount: ${amount}, transaction ID: ${transactionId}, fraud score: ${fraudCheck.fraudScore}`);
                          
                          res.json({
                            success: true,
                            message: 'Money sent successfully',
                            transaction: {
                              id: transactionId,
                              type: 'transfer',
                              amount: amount,
                              currency: 'INR',
                              status: 'completed',
                              fraudScore: fraudCheck.fraudScore,
                              createdAt: now,
                              recipient: {
                                id: recipient.id,
                                username: recipient.username
                              },
                              description: description || ''
                            },
                            wallet: {
                              balance: updatedSenderWallet.balance,
                              currency: updatedSenderWallet.currency
                            }
                          });
                        });
                      }
                    );
                  }
                );
              }
            );
          });
        })
        .catch(error => {
          console.error('Fraud detection error:', error);
          res.status(500).json({ success: false, message: 'Error processing request' });
        });
    });
  });
}

// Get transaction history
app.get('/api/wallet/transactions', protect, (req, res) => {
  const query = `
    SELECT t.*, 
           s.username as senderUsername, 
           r.username as recipientUsername
    FROM Transactions t
    LEFT JOIN Users s ON t.senderId = s.id
    LEFT JOIN Users r ON t.recipientId = r.id
    WHERE t.senderId = ? OR t.recipientId = ?
    ORDER BY t.createdAt DESC
  `;
  
  db.all(query, [req.user.id, req.user.id], (err, transactions) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    
    const formattedTransactions = transactions.map(t => {
      const transaction = {
        id: t.id,
        type: t.type,
        amount: t.amount,
        currency: t.currency,
        status: t.status,
        createdAt: t.createdAt,
        description: t.description
      };
      
      if (t.type === 'transfer') {
        transaction.sender = {
          id: t.senderId,
          username: t.senderUsername
        };
        
        if (t.recipientId) {
          transaction.recipient = {
            id: t.recipientId,
            username: t.recipientUsername
          };
        }
      } else {
        transaction.sender = {
          id: t.senderId,
          username: t.senderUsername
        };
      }
      
      return transaction;
    });
    
    res.json({
      success: true,
      transactions: formattedTransactions
    });
  });
});

// Add a new endpoint for flagged transactions
app.get('/api/admin/transactions/flagged', protect, (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }
  
  const query = `
    SELECT t.*, 
           s.username as senderUsername, 
           s.email as senderEmail,
           r.username as recipientUsername,
           r.email as recipientEmail
    FROM Transactions t
    LEFT JOIN Users s ON t.senderId = s.id
    LEFT JOIN Users r ON t.recipientId = r.id
    WHERE t.fraudScore >= 60
    ORDER BY t.createdAt DESC
  `;
  
  db.all(query, [], (err, transactions) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    
    const formattedTransactions = transactions.map(t => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      currency: t.currency,
      status: t.status,
      fraudScore: t.fraudScore,
      flagged: t.flagged === 1,
      flagReason: t.flagReason,
      createdAt: t.createdAt,
      description: t.description,
      sender: {
        id: t.senderId,
        username: t.senderUsername,
        email: t.senderEmail
      },
      recipient: t.recipientId ? {
        id: t.recipientId,
        username: t.recipientUsername,
        email: t.recipientEmail
      } : null
    }));
    
    res.json({
      success: true,
      transactions: formattedTransactions
    });
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
}); 