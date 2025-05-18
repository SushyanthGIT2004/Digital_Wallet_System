const Wallet = require('../models/wallet.model');
const Transaction = require('../models/transaction.model');
const User = require('../models/user.model');
const { detectFraud } = require('../utils/fraudDetection');
const { validationResult } = require('express-validator');

/**
 * Get user wallet details
 * @route GET /api/wallet
 */
exports.getWallet = async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ user: req.user._id });
    
    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: 'Wallet not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        id: wallet._id,
        balance: wallet.balance,
        formattedBalance: wallet.formattedBalance,
        currency: wallet.currency,
        lastTransaction: wallet.lastTransaction
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching wallet',
      error: error.message
    });
  }
};

/**
 * Deposit funds to wallet
 * @route POST /api/wallet/deposit
 */
exports.deposit = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { amount, description } = req.body;
    const currency = req.body.currency || 'USD';

    // Find user wallet
    const wallet = await Wallet.findOne({ user: req.user._id });
    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: 'Wallet not found'
      });
    }

    // Create a transaction first as pending
    const transaction = await Transaction.create({
      sender: req.user._id,
      amount,
      currency,
      type: 'deposit',
      status: 'pending',
      description: description || 'Deposit to wallet'
    });

    // Check for potential fraud
    const fraudCheck = await detectFraud(transaction, req.user);
    
    if (fraudCheck.isFraudulent) {
      // Flag the transaction
      await transaction.flag(fraudCheck.reasons.join(', '));
      
      return res.status(400).json({
        success: false,
        message: 'Transaction flagged for review',
        data: {
          transactionId: transaction._id,
          status: 'flagged',
          reasons: fraudCheck.reasons
        }
      });
    }

    // If no fraud detected, process the deposit
    try {
      await wallet.deposit(amount);
      
      // Mark transaction as completed
      transaction.status = 'completed';
      transaction.fraudScore = fraudCheck.fraudScore;
      await transaction.save();

      res.status(200).json({
        success: true,
        message: 'Deposit successful',
        data: {
          transactionId: transaction._id,
          amount,
          currency,
          walletBalance: wallet.balance
        }
      });
    } catch (error) {
      // Mark transaction as failed
      transaction.status = 'failed';
      transaction.metadata = { 
        failureReason: error.message 
      };
      await transaction.save();

      throw error;
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error processing deposit',
      error: error.message
    });
  }
};

/**
 * Withdraw funds from wallet
 * @route POST /api/wallet/withdraw
 */
exports.withdraw = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { amount, description } = req.body;
    const currency = req.body.currency || 'USD';

    // Find user wallet
    const wallet = await Wallet.findOne({ user: req.user._id });
    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: 'Wallet not found'
      });
    }

    // Check if user has sufficient funds
    if (wallet.balance < amount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient funds'
      });
    }

    // Create a transaction first as pending
    const transaction = await Transaction.create({
      sender: req.user._id,
      amount,
      currency,
      type: 'withdrawal',
      status: 'pending',
      description: description || 'Withdrawal from wallet'
    });

    // Check for potential fraud
    const fraudCheck = await detectFraud(transaction, req.user);
    
    if (fraudCheck.isFraudulent) {
      // Flag the transaction
      await transaction.flag(fraudCheck.reasons.join(', '));
      
      return res.status(400).json({
        success: false,
        message: 'Transaction flagged for review',
        data: {
          transactionId: transaction._id,
          status: 'flagged',
          reasons: fraudCheck.reasons
        }
      });
    }

    // If no fraud detected, process the withdrawal
    try {
      await wallet.withdraw(amount);
      
      // Mark transaction as completed
      transaction.status = 'completed';
      transaction.fraudScore = fraudCheck.fraudScore;
      await transaction.save();

      res.status(200).json({
        success: true,
        message: 'Withdrawal successful',
        data: {
          transactionId: transaction._id,
          amount,
          currency,
          walletBalance: wallet.balance
        }
      });
    } catch (error) {
      // Mark transaction as failed
      transaction.status = 'failed';
      transaction.metadata = { 
        failureReason: error.message 
      };
      await transaction.save();

      throw error;
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error processing withdrawal',
      error: error.message
    });
  }
};

/**
 * Transfer funds to another user
 * @route POST /api/wallet/transfer
 */
exports.transfer = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { recipientId, amount, description } = req.body;
    const currency = req.body.currency || 'USD';

    // Check if sender and recipient are different
    if (req.user._id.toString() === recipientId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot transfer to yourself'
      });
    }

    // Find sender wallet
    const senderWallet = await Wallet.findOne({ user: req.user._id });
    if (!senderWallet) {
      return res.status(404).json({
        success: false,
        message: 'Sender wallet not found'
      });
    }

    // Check if sender has sufficient funds
    if (senderWallet.balance < amount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient funds'
      });
    }

    // Find recipient
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'Recipient not found'
      });
    }

    // Find recipient wallet
    const recipientWallet = await Wallet.findOne({ user: recipientId });
    if (!recipientWallet) {
      return res.status(404).json({
        success: false,
        message: 'Recipient wallet not found'
      });
    }

    // Create a transaction first as pending
    const transaction = await Transaction.create({
      sender: req.user._id,
      recipient: recipientId,
      amount,
      currency,
      type: 'transfer',
      status: 'pending',
      description: description || 'Transfer to another user'
    });

    // Check for potential fraud
    const fraudCheck = await detectFraud(transaction, req.user);
    
    if (fraudCheck.isFraudulent) {
      // Flag the transaction
      await transaction.flag(fraudCheck.reasons.join(', '));
      
      return res.status(400).json({
        success: false,
        message: 'Transaction flagged for review',
        data: {
          transactionId: transaction._id,
          status: 'flagged',
          reasons: fraudCheck.reasons
        }
      });
    }

    // If no fraud detected, process the transfer
    try {
      // Withdraw from sender
      await senderWallet.withdraw(amount);
      
      // Deposit to recipient
      await recipientWallet.deposit(amount);
      
      // Mark transaction as completed
      transaction.status = 'completed';
      transaction.fraudScore = fraudCheck.fraudScore;
      await transaction.save();

      res.status(200).json({
        success: true,
        message: 'Transfer successful',
        data: {
          transactionId: transaction._id,
          amount,
          currency,
          walletBalance: senderWallet.balance,
          recipient: {
            id: recipient._id,
            username: recipient.username
          }
        }
      });
    } catch (error) {
      // Mark transaction as failed
      transaction.status = 'failed';
      transaction.metadata = { 
        failureReason: error.message 
      };
      await transaction.save();

      throw error;
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error processing transfer',
      error: error.message
    });
  }
};

/**
 * Get transaction history
 * @route GET /api/wallet/transactions
 */
exports.getTransactionHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get transactions where user is either sender or recipient
    const transactions = await Transaction.find({
      $or: [
        { sender: req.user._id },
        { recipient: req.user._id }
      ]
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('sender recipient', 'username email');

    // Count total transactions
    const totalTransactions = await Transaction.countDocuments({
      $or: [
        { sender: req.user._id },
        { recipient: req.user._id }
      ]
    });

    res.status(200).json({
      success: true,
      data: {
        transactions,
        pagination: {
          totalTransactions,
          totalPages: Math.ceil(totalTransactions / limit),
          currentPage: page,
          limit
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching transaction history',
      error: error.message
    });
  }
};

/**
 * Get transaction details
 * @route GET /api/wallet/transactions/:id
 */
exports.getTransactionDetails = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    
    const transaction = await Transaction.findById(req.params.id)
      .populate('sender recipient', 'username email');

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Check if user is sender or recipient
    if (
      transaction.sender._id.toString() !== req.user._id.toString() &&
      (transaction.recipient?._id.toString() !== req.user._id.toString())
    ) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this transaction'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        transaction
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching transaction details',
      error: error.message
    });
  }
}; 