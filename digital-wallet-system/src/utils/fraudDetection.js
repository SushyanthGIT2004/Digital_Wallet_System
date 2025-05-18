const Transaction = require('../models/transaction.model');
const User = require('../models/user.model');

/**
 * Transaction amount thresholds for different operations
 */
const TRANSACTION_THRESHOLDS = {
  TRANSFER: {
    LARGE: 50000,     // Transfers >= ₹50k trigger alerts
    VERY_LARGE: 100000 // Transfers >= ₹100k trigger higher fraud score
  },
  WITHDRAWAL: {
    LARGE: 25000,      // Withdrawals >= ₹25k trigger alerts
    VERY_LARGE: 75000  // Withdrawals >= ₹75k trigger higher fraud score
  }
};

/**
 * Check if transaction amount is unusually high for the user
 * @param {Object} user - User object
 * @param {Number} amount - Transaction amount
 * @param {String} transactionType - Type of transaction
 * @returns {Object} - Result with isSuspicious flag and reason
 */
const checkUnusualAmount = async (user, amount, transactionType) => {
  try {
    // Get user's average transaction amount for the past 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const userTransactions = await Transaction.find({
      sender: user._id,
      type: transactionType,
      status: 'completed',
      createdAt: { $gte: thirtyDaysAgo }
    });

    if (userTransactions.length === 0) {
      // First transaction of this type, use a default threshold
      return {
        isSuspicious: amount > 1000, // Default threshold for new users
        reason: amount > 1000 ? 'Unusually high amount for a first transaction' : null
      };
    }

    // Calculate average transaction amount
    const totalAmount = userTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    const avgAmount = totalAmount / userTransactions.length;

    // Check if current transaction is significantly higher than average (e.g., 3x)
    const threshold = avgAmount * 3;
    
    return {
      isSuspicious: amount > threshold,
      reason: amount > threshold ? `Amount ${amount} is significantly higher than user average ${avgAmount.toFixed(2)}` : null
    };
  } catch (error) {
    console.error('Error in checkUnusualAmount:', error);
    return { isSuspicious: false, reason: null };
  }
};

/**
 * Check if user is making multiple transactions in a short period
 * @param {Object} user - User object
 * @returns {Object} - Result with isSuspicious flag and reason
 */
const checkTransactionFrequency = async (user) => {
  try {
    // Look for multiple transactions in the last hour
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const recentTransactions = await Transaction.find({
      sender: user._id,
      createdAt: { $gte: oneHourAgo }
    });

    // Threshold for suspicious activity (e.g., more than 5 transactions per hour)
    const threshold = 5;
    
    return {
      isSuspicious: recentTransactions.length > threshold,
      reason: recentTransactions.length > threshold 
        ? `User made ${recentTransactions.length} transactions in the last hour` 
        : null
    };
  } catch (error) {
    console.error('Error in checkTransactionFrequency:', error);
    return { isSuspicious: false, reason: null };
  }
};

/**
 * Fraud Detection Utility for Digital Wallet System
 * Contains functions to detect suspicious patterns in transactions
 */

/**
 * Check if user is making multiple transfers in a short period
 * @param {number} userId - User ID
 * @param {object} db - Database connection
 * @returns {Promise<object>} - Results with isSuspicious flag and reason
 */
const checkMultipleTransfers = (userId, db) => {
  return new Promise((resolve, reject) => {
    // Look for multiple transfers in the last 10 minutes
    const tenMinutesAgo = new Date();
    tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 10);
    const timeThreshold = tenMinutesAgo.toISOString();
    
    const query = `
      SELECT COUNT(*) as transferCount 
      FROM Transactions 
      WHERE senderId = ? 
      AND type = 'transfer' 
      AND createdAt > ? 
      AND status = 'completed'
    `;
    
    db.get(query, [userId, timeThreshold], (err, result) => {
      if (err) {
        console.error('Error in checkMultipleTransfers:', err);
        return resolve({ isSuspicious: false, reason: null });
      }
      
      // Threshold for suspicious activity (e.g., more than 3 transfers in 10 minutes)
      const threshold = 3;
      const isSuspicious = result.transferCount >= threshold;
      
      resolve({
        isSuspicious,
        reason: isSuspicious ? `User made ${result.transferCount} transfers in the last 10 minutes` : null,
        score: isSuspicious ? 50 : 0
      });
    });
  });
};

/**
 * Check if user is making multiple transfers to the same recipient
 * @param {number} userId - User ID
 * @param {number} recipientId - Recipient ID
 * @param {object} db - Database connection
 * @returns {Promise<object>} - Results with isSuspicious flag and reason
 */
const checkRepeatedTransfersToSameRecipient = (userId, recipientId, db) => {
  return new Promise((resolve, reject) => {
    // Look for transactions to the same recipient in the last 24 hours
    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);
    const timeThreshold = oneDayAgo.toISOString();
    
    const query = `
      SELECT COUNT(*) as transferCount,
             r.username as recipientName,
             r.email as recipientEmail
      FROM Transactions t
      LEFT JOIN Users r ON t.recipientId = r.id
      WHERE t.senderId = ? 
      AND t.recipientId = ?
      AND t.type = 'transfer' 
      AND t.createdAt > ? 
      AND t.status = 'completed'
    `;
    
    db.get(query, [userId, recipientId, timeThreshold], (err, result) => {
      if (err) {
        console.error('Error in checkRepeatedTransfersToSameRecipient:', err);
        return resolve({ isSuspicious: false, reason: null });
      }
      
      // Threshold for suspicious activity (more than 3 transfers to same recipient in 24 hours)
      const threshold = 3;
      const isSuspicious = result.transferCount >= threshold;
      
      resolve({
        isSuspicious,
        reason: isSuspicious ? `User made ${result.transferCount} transfers to the same recipient (${result.recipientEmail}) in the last 24 hours` : null,
        score: isSuspicious ? 60 : 0
      });
    });
  });
};

/**
 * Check if withdrawal amount is unusually large compared to user's average withdrawals
 * @param {number} userId - User ID
 * @param {number} amount - Transaction amount
 * @param {object} db - Database connection
 * @returns {Promise<object>} - Results with isSuspicious flag and reason
 */
const checkLargeWithdrawal = (userId, amount, db) => {
  return new Promise((resolve, reject) => {
    // Get user's average withdrawal amount for the past 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const timeThreshold = thirtyDaysAgo.toISOString();
    
    const query = `
      SELECT AVG(amount) as avgAmount, MAX(amount) as maxAmount
      FROM Transactions 
      WHERE senderId = ? 
      AND type = 'withdrawal' 
      AND createdAt > ? 
      AND status = 'completed'
    `;
    
    db.get(query, [userId, timeThreshold], (err, result) => {
      if (err) {
        console.error('Error in checkLargeWithdrawal:', err);
        return resolve({ isSuspicious: false, reason: null });
      }
      
      // If no prior withdrawals, check if this one is large in absolute terms
      if (!result.avgAmount) {
        const isLarge = amount > 10000; // Default threshold for new users
        return resolve({
          isSuspicious: isLarge,
          reason: isLarge ? 'Unusually large first withdrawal' : null,
          score: isLarge ? 40 : 0
        });
      }
      
      // Check if current withdrawal is significantly higher than average (e.g., 3x)
      const isSignificantlyHigher = amount > (result.avgAmount * 3);
      // Check if it's the largest withdrawal so far
      const isLargest = amount > result.maxAmount;
      
      const isSuspicious = isSignificantlyHigher && isLargest;
      
      resolve({
        isSuspicious,
        reason: isSuspicious ? `Withdrawal amount ${amount} is significantly higher than user average ${result.avgAmount.toFixed(2)}` : null,
        score: isSuspicious ? 60 : (isSignificantlyHigher ? 30 : 0)
      });
    });
  });
};

/**
 * Check wallet balance percentage being withdrawn
 * @param {number} userId - User ID
 * @param {number} amount - Transaction amount
 * @param {object} db - Database connection
 * @returns {Promise<object>} - Results with isSuspicious flag and reason
 */
const checkBalancePercentage = (userId, amount, db) => {
  return new Promise((resolve, reject) => {
    const query = `SELECT balance FROM Wallets WHERE userId = ?`;
    
    db.get(query, [userId], (err, wallet) => {
      if (err || !wallet) {
        console.error('Error in checkBalancePercentage:', err);
        return resolve({ isSuspicious: false, reason: null });
      }
      
      const percentageOfBalance = (amount / wallet.balance) * 100;
      
      // Flag if more than 70% of balance is being withdrawn in one go
      const isSuspicious = percentageOfBalance > 70;
      
      resolve({
        isSuspicious,
        reason: isSuspicious ? `Withdrawal of ${percentageOfBalance.toFixed(2)}% of total balance` : null,
        score: isSuspicious ? 40 : 0
      });
    });
  });
};

/**
 * Check if transaction amount exceeds predefined thresholds
 * @param {string} type - Transaction type (transfer, withdrawal)
 * @param {number} amount - Transaction amount
 * @returns {Promise<object>} - Results with isSuspicious flag and reason
 */
const checkThresholdAmount = (type, amount) => {
  return new Promise((resolve) => {
    let threshold, isSuspicious = false, reason = null, score = 0;
    
    if (type === 'transfer') {
      if (amount >= TRANSACTION_THRESHOLDS.TRANSFER.VERY_LARGE) {
        isSuspicious = true;
        reason = `Very large transfer amount: ₹${amount}`;
        score = 40;
      } else if (amount >= TRANSACTION_THRESHOLDS.TRANSFER.LARGE) {
        isSuspicious = true;
        reason = `Large transfer amount: ₹${amount}`;
        score = 20;
      }
    } else if (type === 'withdrawal') {
      if (amount >= TRANSACTION_THRESHOLDS.WITHDRAWAL.VERY_LARGE) {
        isSuspicious = true;
        reason = `Very large withdrawal amount: ₹${amount}`;
        score = 40;
      } else if (amount >= TRANSACTION_THRESHOLDS.WITHDRAWAL.LARGE) {
        isSuspicious = true;
        reason = `Large withdrawal amount: ₹${amount}`;
        score = 20;
      }
    }
    
    resolve({
      isSuspicious,
      reason,
      score,
      isLarge: isSuspicious // Flag to indicate this is a "large" transaction
    });
  });
};

/**
 * Main fraud detection function
 * @param {object} transaction - Transaction object with type, amount, senderId, recipientId
 * @param {number} userId - User ID
 * @param {object} db - Database connection
 * @returns {Promise<object>} - Result of fraud detection with fraud score and reasons
 */
const detectFraud = async (transaction, userId, db) => {
  const checks = [];
  const reasons = [];
  let fraudScore = 0;
  let isLargeTransaction = false;

  // Add checks based on transaction type
  if (transaction.type === 'transfer') {
    checks.push(checkMultipleTransfers(userId, db));
    checks.push(checkThresholdAmount('transfer', transaction.amount));
    
    if (transaction.recipientId) {
      checks.push(checkRepeatedTransfersToSameRecipient(userId, transaction.recipientId, db));
    }
    
    checks.push(checkBalancePercentage(userId, transaction.amount, db));
  }
  
  if (transaction.type === 'withdrawal') {
    checks.push(checkLargeWithdrawal(userId, transaction.amount, db));
    checks.push(checkThresholdAmount('withdrawal', transaction.amount));
    checks.push(checkBalancePercentage(userId, transaction.amount, db));
  }
  
  // Wait for all checks to complete
  const results = await Promise.all(checks);
  
  // Aggregate results
  results.forEach(result => {
    if (result.isSuspicious) {
      reasons.push(result.reason);
      fraudScore += result.score || 10; // Default score of 10 if not specified
      
      // Check if this is a large transaction alert
      if (result.isLarge) {
        isLargeTransaction = true;
      }
    }
  });
  
  // Normalize fraud score to a maximum of 100
  fraudScore = Math.min(fraudScore, 100);
  
  return {
    isFraudulent: fraudScore >= 70, // Threshold for blocking transaction
    fraudScore,
    reasons,
    isLargeTransaction
  };
};

module.exports = {
  detectFraud,
  checkUnusualAmount,
  checkTransactionFrequency,
  checkMultipleTransfers,
  checkRepeatedTransfersToSameRecipient,
  checkLargeWithdrawal,
  checkBalancePercentage,
  TRANSACTION_THRESHOLDS
}; 