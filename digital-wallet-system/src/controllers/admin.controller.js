const User = require('../models/user.model');
const Wallet = require('../models/wallet.model');
const Transaction = require('../models/transaction.model');
const { validationResult } = require('express-validator');

/**
 * Get all users
 * @route GET /api/admin/users
 */
exports.getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const users = await User.find({ deletedAt: null })
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalUsers = await User.countDocuments({ deletedAt: null });

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          totalUsers,
          totalPages: Math.ceil(totalUsers / limit),
          currentPage: page,
          limit
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message
    });
  }
};

/**
 * Get user by ID
 * @route GET /api/admin/users/:id
 */
exports.getUserById = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's wallet
    const wallet = await Wallet.findOne({ user: user._id });

    // Get user's recent transactions
    const recentTransactions = await Transaction.find({
      $or: [
        { sender: user._id },
        { recipient: user._id }
      ]
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('sender recipient', 'username email');

    res.status(200).json({
      success: true,
      data: {
        user,
        wallet,
        recentTransactions
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user',
      error: error.message
    });
  }
};

/**
 * Update user
 * @route PUT /api/admin/users/:id
 */
exports.updateUser = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    
    const { username, email, role, isActive } = req.body;
    const updates = {};

    // Build update object with only provided fields
    if (username !== undefined) updates.username = username;
    if (email !== undefined) updates.email = email;
    if (role !== undefined) updates.role = role;
    if (isActive !== undefined) updates.isActive = isActive;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        user
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating user',
      error: error.message
    });
  }
};

/**
 * Delete user (soft delete)
 * @route DELETE /api/admin/users/:id
 */
exports.deleteUser = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Apply soft delete
    user.deletedAt = new Date();
    user.isActive = false;
    await user.save();

    // Also deactivate user's wallet
    const wallet = await Wallet.findOne({ user: user._id });
    if (wallet) {
      wallet.isActive = false;
      wallet.deletedAt = new Date();
      await wallet.save();
    }

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting user',
      error: error.message
    });
  }
};

/**
 * Get flagged transactions
 * @route GET /api/admin/transactions/flagged
 */
exports.getFlaggedTransactions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const transactions = await Transaction.find({
      flagged: true,
      status: 'flagged'
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('sender recipient', 'username email');

    const totalTransactions = await Transaction.countDocuments({
      flagged: true,
      status: 'flagged'
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
      message: 'Error fetching flagged transactions',
      error: error.message
    });
  }
};

/**
 * Review flagged transaction
 * @route POST /api/admin/transactions/:id/review
 */
exports.reviewTransaction = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    
    const { action, comments } = req.body;
    
    const transaction = await Transaction.findById(req.params.id);
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    if (transaction.status !== 'flagged') {
      return res.status(400).json({
        success: false,
        message: 'Only flagged transactions can be reviewed'
      });
    }

    // Update transaction based on action
    if (action === 'approve') {
      // Process the transaction
      const sender = await User.findById(transaction.sender);
      if (!sender) {
        return res.status(404).json({
          success: false,
          message: 'Sender not found'
        });
      }

      const senderWallet = await Wallet.findOne({ user: transaction.sender });
      if (!senderWallet) {
        return res.status(404).json({
          success: false,
          message: 'Sender wallet not found'
        });
      }

      try {
        if (transaction.type === 'deposit') {
          await senderWallet.deposit(transaction.amount);
        } else if (transaction.type === 'withdrawal') {
          await senderWallet.withdraw(transaction.amount);
        } else if (transaction.type === 'transfer') {
          const recipientWallet = await Wallet.findOne({ user: transaction.recipient });
          if (!recipientWallet) {
            return res.status(404).json({
              success: false,
              message: 'Recipient wallet not found'
            });
          }

          await senderWallet.withdraw(transaction.amount);
          await recipientWallet.deposit(transaction.amount);
        }

        // Update transaction status
        transaction.status = 'completed';
        transaction.flagged = false;
        transaction.reviewedBy = req.user._id;
        transaction.reviewedAt = new Date();
        transaction.metadata = {
          ...transaction.metadata,
          reviewComments: comments,
          reviewAction: action
        };
        await transaction.save();

        res.status(200).json({
          success: true,
          message: 'Transaction approved and processed successfully',
          data: {
            transaction
          }
        });
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'Error processing transaction',
          error: error.message
        });
      }
    } else if (action === 'reject') {
      // Reject the transaction
      transaction.status = 'failed';
      transaction.reviewedBy = req.user._id;
      transaction.reviewedAt = new Date();
      transaction.metadata = {
        ...transaction.metadata,
        reviewComments: comments,
        reviewAction: action,
        rejectionReason: comments || 'Rejected by admin'
      };
      await transaction.save();

      res.status(200).json({
        success: true,
        message: 'Transaction rejected successfully',
        data: {
          transaction
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Use "approve" or "reject"'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error reviewing transaction',
      error: error.message
    });
  }
};

/**
 * Get system overview statistics
 * @route GET /api/admin/stats/overview
 */
exports.getOverviewStats = async (req, res) => {
  try {
    // Get basic counts
    const totalUsers = await User.countDocuments({ deletedAt: null });
    const totalWallets = await Wallet.countDocuments({ deletedAt: null });
    const totalTransactions = await Transaction.countDocuments({ deletedAt: null });
    const flaggedTransactions = await Transaction.countDocuments({ flagged: true, status: 'flagged' });
    
    // Get transaction volume
    const transactions = await Transaction.find({ 
      status: 'completed',
      deletedAt: null 
    });
    
    const transactionVolume = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    
    // Get recent transactions
    const recentTransactions = await Transaction.find({ deletedAt: null })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('sender recipient', 'username email');

    // Get recent users
    const recentUsers = await User.find({ deletedAt: null })
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(5);

    res.status(200).json({
      success: true,
      data: {
        counts: {
          totalUsers,
          totalWallets,
          totalTransactions,
          flaggedTransactions
        },
        transactionVolume,
        recentTransactions,
        recentUsers
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching overview statistics',
      error: error.message
    });
  }
};

/**
 * Get transaction statistics
 * @route GET /api/admin/stats/transactions
 */
exports.getTransactionStats = async (req, res) => {
  try {
    // Get transaction counts by type
    const depositCount = await Transaction.countDocuments({ type: 'deposit', status: 'completed' });
    const withdrawalCount = await Transaction.countDocuments({ type: 'withdrawal', status: 'completed' });
    const transferCount = await Transaction.countDocuments({ type: 'transfer', status: 'completed' });
    
    // Get transaction volume by type
    const depositTransactions = await Transaction.find({ type: 'deposit', status: 'completed' });
    const withdrawalTransactions = await Transaction.find({ type: 'withdrawal', status: 'completed' });
    const transferTransactions = await Transaction.find({ type: 'transfer', status: 'completed' });
    
    const depositVolume = depositTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    const withdrawalVolume = withdrawalTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    const transferVolume = transferTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    
    // Get transaction counts by status
    const pendingCount = await Transaction.countDocuments({ status: 'pending' });
    const completedCount = await Transaction.countDocuments({ status: 'completed' });
    const failedCount = await Transaction.countDocuments({ status: 'failed' });
    const flaggedCount = await Transaction.countDocuments({ status: 'flagged' });
    
    // Get recent flagged transactions
    const recentFlaggedTransactions = await Transaction.find({ flagged: true })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('sender recipient', 'username email');

    res.status(200).json({
      success: true,
      data: {
        transactionsByType: {
          deposit: {
            count: depositCount,
            volume: depositVolume
          },
          withdrawal: {
            count: withdrawalCount,
            volume: withdrawalVolume
          },
          transfer: {
            count: transferCount,
            volume: transferVolume
          }
        },
        transactionsByStatus: {
          pending: pendingCount,
          completed: completedCount,
          failed: failedCount,
          flagged: flaggedCount
        },
        totalVolume: depositVolume + withdrawalVolume + transferVolume,
        recentFlaggedTransactions
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching transaction statistics',
      error: error.message
    });
  }
};

/**
 * Get user statistics
 * @route GET /api/admin/stats/users
 */
exports.getUserStats = async (req, res) => {
  try {
    // Get user counts
    const totalUsers = await User.countDocuments({ deletedAt: null });
    const activeUsers = await User.countDocuments({ isActive: true, deletedAt: null });
    const inactiveUsers = await User.countDocuments({ isActive: false, deletedAt: null });
    const adminUsers = await User.countDocuments({ role: 'admin', deletedAt: null });
    
    // Get users with highest wallet balance
    const topWallets = await Wallet.find({ deletedAt: null })
      .sort({ balance: -1 })
      .limit(5)
      .populate('user', 'username email');
    
    // Get users with most transactions
    const transactionCounts = await Transaction.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: '$sender', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    
    const userIds = transactionCounts.map(item => item._id);
    const usersWithMostTransactions = await User.find({ 
      _id: { $in: userIds },
      deletedAt: null 
    }).select('_id username email');
    
    // Map transaction counts to users
    const usersWithTransactionCounts = usersWithMostTransactions.map(user => {
      const transactionInfo = transactionCounts.find(
        item => item._id.toString() === user._id.toString()
      );
      return {
        user: {
          id: user._id,
          username: user.username,
          email: user.email
        },
        transactionCount: transactionInfo ? transactionInfo.count : 0
      };
    });

    res.status(200).json({
      success: true,
      data: {
        userCounts: {
          total: totalUsers,
          active: activeUsers,
          inactive: inactiveUsers,
          admins: adminUsers
        },
        topWallets,
        topTransactors: usersWithTransactionCounts
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user statistics',
      error: error.message
    });
  }
};

/**
 * Get fraud detection settings
 * @route GET /api/admin/fraud-detection/settings
 */
exports.getFraudDetectionSettings = async (req, res) => {
  try {
    // This would typically come from a database, but for simplicity, 
    // we'll return default settings
    const settings = {
      thresholds: {
        highTransactionAmount: 1000,
        unusualAmountMultiplier: 3,
        maxTransactionsPerHour: 5,
        fraudScoreThreshold: 60
      },
      rateLimits: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 100
      }
    };

    res.status(200).json({
      success: true,
      data: {
        settings
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching fraud detection settings',
      error: error.message
    });
  }
};

/**
 * Update fraud detection settings
 * @route PUT /api/admin/fraud-detection/settings
 */
exports.updateFraudDetectionSettings = async (req, res) => {
  try {
    const { rateLimits, thresholds } = req.body;
    
    // This would typically update settings in a database,
    // but for this example, we'll just return what was sent
    const updatedSettings = {
      thresholds: {
        ...thresholds
      },
      rateLimits: {
        ...rateLimits
      }
    };

    res.status(200).json({
      success: true,
      message: 'Fraud detection settings updated successfully',
      data: {
        settings: updatedSettings
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating fraud detection settings',
      error: error.message
    });
  }
};

/**
 * Get system logs
 * @route GET /api/admin/logs
 */
exports.getSystemLogs = async (req, res) => {
  try {
    // This would typically fetch logs from a logging service or database
    // For this example, we'll return mock logs
    const logs = [
      {
        timestamp: new Date(),
        level: 'info',
        message: 'System startup',
        source: 'server'
      },
      {
        timestamp: new Date(Date.now() - 1000 * 60 * 5),
        level: 'warn',
        message: 'High CPU usage detected',
        source: 'monitoring'
      },
      {
        timestamp: new Date(Date.now() - 1000 * 60 * 10),
        level: 'error',
        message: 'Database connection error',
        source: 'database',
        details: 'Connection timeout after 5000ms'
      }
    ];

    res.status(200).json({
      success: true,
      data: {
        logs
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching system logs',
      error: error.message
    });
  }
}; 