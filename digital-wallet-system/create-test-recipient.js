const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

// Open database connection
const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) {
    console.error('Database connection error:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database');
});

// Create a test recipient
const createTestRecipient = () => {
  const now = new Date().toISOString();
  
  // Hash password
  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync('password123', salt);
  
  // Check if recipient already exists
  db.get('SELECT * FROM Users WHERE email = ?', ['recipient@example.com'], (err, user) => {
    if (err) {
      console.error('Error checking for existing user:', err.message);
      db.close();
      return;
    }
    
    if (user) {
      console.log('Test recipient already exists');
      db.close();
      return;
    }
    
    // Insert new user
    db.run(
      'INSERT INTO Users (username, email, password, role, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['recipient', 'recipient@example.com', hashedPassword, 'user', 1, now, now],
      function(err) {
        if (err) {
          console.error('Error creating test recipient:', err.message);
          db.close();
          return;
        }
        
        const userId = this.lastID;
        
        // Create wallet for new user
        db.run(
          'INSERT INTO Wallets (userId, balance, currency, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
          [userId, 0, 'INR', 1, now, now],
          function(err) {
            if (err) {
              console.error('Error creating test recipient wallet:', err.message);
              db.close();
              return;
            }
            
            console.log('Test recipient created successfully');
            console.log('Email: recipient@example.com');
            console.log('Password: password123');
            db.close();
          }
        );
      }
    );
  });
};

// Run the function
createTestRecipient(); 