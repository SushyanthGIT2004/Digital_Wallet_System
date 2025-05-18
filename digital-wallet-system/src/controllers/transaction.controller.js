const Transaction = require('../models/transaction.model');
const { validationResult } = require('express-validator');

/**
 * Get all transactions with filters and pagination
 * @route GET /api/transactions
 */
exports.getTransactions = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    
    const {
      page = 1,
      limit = 10,
      status,
      type,
      startDate,
      endDate,
      minAmount,
      maxAmount
    } = req.query;

    // Build filter object
    const filter = { sender: req.user._id };
    
    // Add filters if provided
    if (status) filter.status = status;
    if (type) filter.type = type;
    
    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    
    // Amount range filter
    if (minAmount || maxAmount) {
      filter.amount = {};
      if (minAmount) filter.amount.$gte = Number(minAmount);
      if (maxAmount) filter.amount.$lte = Number(maxAmount);
    }

    // Calculate pagination
    const skip = (Number(page) - 1) * Number(limit);
    
    // Execute query
    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('sender recipient', 'username email');
    
    // Get total count for pagination
    const totalTransactions = await Transaction.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        transactions,
        pagination: {
          totalTransactions,
          totalPages: Math.ceil(totalTransactions / Number(limit)),
          currentPage: Number(page),
          limit: Number(limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching transactions',
      error: error.message
    });
  }
};

/**
 * Get transaction by ID
 * @route GET /api/transactions/:id
 */
exports.getTransactionById = async (req, res) => {
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

    // Check if user is authorized to view this transaction
    const isAuthorized = 
      transaction.sender._id.toString() === req.user._id.toString() || 
      (transaction.recipient && transaction.recipient._id.toString() === req.user._id.toString()) ||
      req.user.role === 'admin';

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view this transaction'
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
      message: 'Error fetching transaction',
      error: error.message
    });
  }
};

/**
 * Search transactions
 * @route GET /api/transactions/search
 */
exports.searchTransactions = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    
    const { reference, keyword } = req.query;
    const filter = { sender: req.user._id };

    // Search by reference
    if (reference) {
      filter.reference = { $regex: reference, $options: 'i' };
    }

    // Search by keyword in description
    if (keyword) {
      filter.description = { $regex: keyword, $options: 'i' };
    }

    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('sender recipient', 'username email');

    res.status(200).json({
      success: true,
      data: {
        transactions,
        count: transactions.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error searching transactions',
      error: error.message
    });
  }
};

/**
 * Cancel a pending transaction
 * @route POST /api/transactions/:id/cancel
 */
exports.cancelTransaction = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Check if user is authorized to cancel this transaction
    if (transaction.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to cancel this transaction'
      });
    }

    // Check if transaction is in a cancellable state
    if (transaction.status !== 'pending' && transaction.status !== 'flagged') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel a transaction with status: ${transaction.status}`
      });
    }

    // Update transaction status to failed
    transaction.status = 'failed';
    transaction.metadata = {
      ...transaction.metadata,
      cancellationReason: 'Cancelled by user',
      cancelledAt: new Date()
    };
    await transaction.save();

    res.status(200).json({
      success: true,
      message: 'Transaction cancelled successfully',
      data: {
        transactionId: transaction._id,
        status: transaction.status
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error cancelling transaction',
      error: error.message
    });
  }
};

/**
 * Soft delete a transaction (admin only)
 * @route DELETE /api/transactions/:id
 */
exports.deleteTransaction = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Apply soft delete
    transaction.deletedAt = new Date();
    await transaction.save();

    res.status(200).json({
      success: true,
      message: 'Transaction deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting transaction',
      error: error.message
    });
  }
}; 