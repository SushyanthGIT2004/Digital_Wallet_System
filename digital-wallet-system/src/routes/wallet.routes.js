const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');

// Import controllers
const walletController = require('../controllers/wallet.controller');

// Import middleware
const authMiddleware = require('../middleware/auth.middleware');

// Get user wallet details
router.get('/', authMiddleware.protect, walletController.getWallet);

// Deposit funds to wallet
router.post('/deposit', [
  authMiddleware.protect,
  body('amount').isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number'),
  body('currency').optional().isString().isLength({ min: 3, max: 3 }),
  body('description').optional().isString()
], walletController.deposit);

// Withdraw funds from wallet
router.post('/withdraw', [
  authMiddleware.protect,
  body('amount').isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number'),
  body('currency').optional().isString().isLength({ min: 3, max: 3 }),
  body('description').optional().isString()
], walletController.withdraw);

// Transfer funds to another user
router.post('/transfer', [
  authMiddleware.protect,
  body('recipientId').isString()
    .withMessage('Recipient ID is required'),
  body('amount').isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number'),
  body('currency').optional().isString().isLength({ min: 3, max: 3 }),
  body('description').optional().isString()
], walletController.transfer);

// Get transaction history
router.get('/transactions', authMiddleware.protect, walletController.getTransactionHistory);

// Get transaction details
router.get('/transactions/:id', [
  authMiddleware.protect,
  param('id').isMongoId().withMessage('Invalid transaction ID')
], walletController.getTransactionDetails);

module.exports = router; 