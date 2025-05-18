const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');

// Import controllers
const transactionController = require('../controllers/transaction.controller');

// Import middleware
const authMiddleware = require('../middleware/auth.middleware');

// Get all transactions (with pagination and filters)
router.get('/', [
  authMiddleware.protect,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['pending', 'completed', 'failed', 'flagged']),
  query('type').optional().isIn(['deposit', 'withdrawal', 'transfer']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('minAmount').optional().isFloat({ min: 0 }),
  query('maxAmount').optional().isFloat({ min: 0 })
], transactionController.getTransactions);

// Get transaction by ID
router.get('/:id', [
  authMiddleware.protect,
  param('id').isMongoId().withMessage('Invalid transaction ID')
], transactionController.getTransactionById);

// Search transactions
router.get('/search', [
  authMiddleware.protect,
  query('reference').optional().isString(),
  query('keyword').optional().isString()
], transactionController.searchTransactions);

// Cancel pending transaction (only works for pending transactions)
router.post('/:id/cancel', [
  authMiddleware.protect,
  param('id').isMongoId().withMessage('Invalid transaction ID')
], transactionController.cancelTransaction);

// Soft delete a transaction (admin only)
router.delete('/:id', [
  authMiddleware.protect,
  authMiddleware.restrictTo('admin'),
  param('id').isMongoId().withMessage('Invalid transaction ID')
], transactionController.deleteTransaction);

module.exports = router; 