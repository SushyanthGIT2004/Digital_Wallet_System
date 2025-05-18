#!/usr/bin/env node

/**
 * API Testing Script for Digital Wallet System
 * 
 * This script demonstrates how to use the Digital Wallet API
 * by making requests to each endpoint.
 * 
 * Usage: node test-api.js
 */

const fetch = require('node-fetch');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const API_URL = 'http://localhost:3000/api';
let authToken = null;
let currentUser = null;

// Helper function to make API requests
async function callAPI(endpoint, method = 'GET', body = null, requiresAuth = false) {
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (requiresAuth && authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  const options = {
    method,
    headers
  };
  
  if (body && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(body);
  }
  
  try {
    const response = await fetch(`${API_URL}${endpoint}`, options);
    return await response.json();
  } catch (error) {
    console.error('API call error:', error.message);
    return { success: false, message: error.message };
  }
}

// User registration
async function register() {
  console.log('\n--- USER REGISTRATION ---');
  
  const email = await promptInput('Enter email: ');
  const username = await promptInput('Enter username: ');
  const password = await promptInput('Enter password: ');
  
  const result = await callAPI('/auth/register', 'POST', {
    email,
    username,
    password
  });
  
  if (result.success) {
    console.log('\n✅ Registration successful!');
    authToken = result.token;
    currentUser = result.user;
    console.log(`Welcome, ${currentUser.username}!`);
  } else {
    console.log('\n❌ Registration failed:', result.message);
  }
  
  return result.success;
}

// User login
async function login() {
  console.log('\n--- USER LOGIN ---');
  
  const email = await promptInput('Enter email: ');
  const password = await promptInput('Enter password: ');
  
  const result = await callAPI('/auth/login', 'POST', {
    email,
    password
  });
  
  if (result.success) {
    console.log('\n✅ Login successful!');
    authToken = result.token;
    currentUser = result.user;
    console.log(`Welcome back, ${currentUser.username}!`);
  } else {
    console.log('\n❌ Login failed:', result.message);
  }
  
  return result.success;
}

// Get wallet details
async function getWallet() {
  console.log('\n--- WALLET DETAILS ---');
  
  const result = await callAPI('/wallet', 'GET', null, true);
  
  if (result.success) {
    console.log(`\n💰 Your balance: ₹${result.wallet.balance.toFixed(2)} ${result.wallet.currency}`);
  } else {
    console.log('\n❌ Could not retrieve wallet:', result.message);
  }
  
  return result.success;
}

// Deposit funds
async function deposit() {
  console.log('\n--- DEPOSIT FUNDS ---');
  
  const amount = parseFloat(await promptInput('Enter amount to deposit: '));
  
  if (isNaN(amount) || amount <= 0) {
    console.log('\n❌ Invalid amount. Please enter a positive number.');
    return false;
  }
  
  const result = await callAPI('/wallet/deposit', 'POST', { amount }, true);
  
  if (result.success) {
    console.log(`\n✅ Successfully deposited ₹${amount}`);
    console.log(`💰 New balance: ₹${result.wallet.balance.toFixed(2)}`);
  } else {
    console.log('\n❌ Deposit failed:', result.message);
  }
  
  return result.success;
}

// Withdraw funds
async function withdraw() {
  console.log('\n--- WITHDRAW FUNDS ---');
  
  const amount = parseFloat(await promptInput('Enter amount to withdraw: '));
  
  if (isNaN(amount) || amount <= 0) {
    console.log('\n❌ Invalid amount. Please enter a positive number.');
    return false;
  }
  
  const result = await callAPI('/wallet/withdraw', 'POST', { amount }, true);
  
  if (result.success) {
    console.log(`\n✅ Successfully withdrawn ₹${amount}`);
    console.log(`💰 New balance: ₹${result.wallet.balance.toFixed(2)}`);
  } else {
    console.log('\n❌ Withdrawal failed:', result.message);
    
    // Check for fraud detection
    if (result.details && result.details.reasons) {
      console.log('\n🚨 Transaction flagged for suspicious activity:');
      result.details.reasons.forEach(reason => {
        console.log(`  - ${reason}`);
      });
      console.log(`  Fraud score: ${result.details.fraudScore}`);
    }
  }
  
  return result.success;
}

// Transfer funds
async function transfer() {
  console.log('\n--- TRANSFER FUNDS ---');
  
  const recipientEmail = await promptInput('Enter recipient email: ');
  const amount = parseFloat(await promptInput('Enter amount to transfer: '));
  const description = await promptInput('Enter description (optional): ');
  
  if (isNaN(amount) || amount <= 0) {
    console.log('\n❌ Invalid amount. Please enter a positive number.');
    return false;
  }
  
  const result = await callAPI('/wallet/transfer', 'POST', {
    recipientEmail,
    amount,
    description
  }, true);
  
  if (result.success) {
    console.log(`\n✅ Successfully transferred ₹${amount} to ${recipientEmail}`);
    console.log(`💰 New balance: ₹${result.wallet.balance.toFixed(2)}`);
  } else {
    console.log('\n❌ Transfer failed:', result.message);
    
    // Check for fraud detection
    if (result.details && result.details.reasons) {
      console.log('\n🚨 Transaction flagged for suspicious activity:');
      result.details.reasons.forEach(reason => {
        console.log(`  - ${reason}`);
      });
      console.log(`  Fraud score: ${result.details.fraudScore}`);
    }
  }
  
  return result.success;
}

// Get transaction history
async function getTransactions() {
  console.log('\n--- TRANSACTION HISTORY ---');
  
  const result = await callAPI('/wallet/transactions', 'GET', null, true);
  
  if (result.success && result.transactions.length > 0) {
    console.log('\n📜 Your recent transactions:');
    
    result.transactions.forEach((tx, index) => {
      const date = new Date(tx.createdAt).toLocaleString();
      let details = '';
      
      if (tx.type === 'deposit') {
        details = `💵 Deposit: +₹${tx.amount}`;
      } else if (tx.type === 'withdrawal') {
        details = `💸 Withdrawal: -₹${tx.amount}`;
      } else if (tx.type === 'transfer') {
        if (tx.sender.id === currentUser.id) {
          details = `➡️ Sent ₹${tx.amount} to ${tx.recipient ? tx.recipient.username : 'unknown'}`;
          if (tx.description) details += ` (${tx.description})`;
        } else {
          details = `⬅️ Received ₹${tx.amount} from ${tx.sender.username}`;
          if (tx.description) details += ` (${tx.description})`;
        }
      }
      
      console.log(`${index + 1}. [${date}] ${details}`);
    });
  } else if (result.success) {
    console.log('\n📭 No transactions found.');
  } else {
    console.log('\n❌ Could not retrieve transactions:', result.message);
  }
  
  return result.success;
}

// Helper function for CLI prompts
function promptInput(question) {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer);
    });
  });
}

// Main menu
async function showMenu() {
  console.log('\n=== DIGITAL WALLET SYSTEM ===');
  console.log('1. Register');
  console.log('2. Login');
  console.log('3. View Wallet Balance');
  console.log('4. Deposit Funds');
  console.log('5. Withdraw Funds');
  console.log('6. Transfer Funds');
  console.log('7. View Transaction History');
  console.log('8. Exit');
  
  const choice = await promptInput('\nEnter your choice (1-8): ');
  
  switch (choice) {
    case '1':
      await register();
      break;
    case '2':
      await login();
      break;
    case '3':
      if (!authToken) {
        console.log('\n❌ You need to login first.');
      } else {
        await getWallet();
      }
      break;
    case '4':
      if (!authToken) {
        console.log('\n❌ You need to login first.');
      } else {
        await deposit();
      }
      break;
    case '5':
      if (!authToken) {
        console.log('\n❌ You need to login first.');
      } else {
        await withdraw();
      }
      break;
    case '6':
      if (!authToken) {
        console.log('\n❌ You need to login first.');
      } else {
        await transfer();
      }
      break;
    case '7':
      if (!authToken) {
        console.log('\n❌ You need to login first.');
      } else {
        await getTransactions();
      }
      break;
    case '8':
      console.log('\nThank you for using Digital Wallet System. Goodbye!');
      rl.close();
      return false;
    default:
      console.log('\n❌ Invalid choice. Please try again.');
  }
  
  return true;
}

// Main function
async function main() {
  console.log('Welcome to Digital Wallet System API Tester');
  console.log('Make sure the server is running on http://localhost:3000');
  
  let continueRunning = true;
  while (continueRunning) {
    continueRunning = await showMenu();
  }
}

// Start the program
main().catch(error => {
  console.error('Error:', error);
  rl.close();
}); 