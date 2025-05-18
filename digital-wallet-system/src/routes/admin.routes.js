const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');

// Import controllers
const adminController = require('../controllers/admin.controller');

// Import middleware
const authMiddleware = require('../middleware/auth.middleware');

// Apply admin-only middleware to all routes
router.use(authMiddleware.protect);
router.use(authMiddleware.restrictTo('admin'));

// User management routes
router.get('/users', adminController.getAllUsers);

router.get('/users/:id', [
  param('id').isMongoId().withMessage('Invalid user ID')
], adminController.getUserById);

router.put('/users/:id', [
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('username').optional().isString().isLength({ min: 3, max: 20 }),
  body('email').optional().isEmail(),
  body('role').optional().isIn(['user', 'admin']),
  body('isActive').optional().isBoolean()
], adminController.updateUser);

router.delete('/users/:id', [
  param('id').isMongoId().withMessage('Invalid user ID')
], adminController.deleteUser);

// Transaction management routes
router.get('/transactions/flagged', adminController.getFlaggedTransactions);

router.post('/transactions/:id/review', [
  param('id').isMongoId().withMessage('Invalid transaction ID'),
  body('action').isIn(['approve', 'reject']),
  body('comments').optional().isString()
], adminController.reviewTransaction);

// Dashboard statistics
router.get('/stats/overview', adminController.getOverviewStats);
router.get('/stats/transactions', adminController.getTransactionStats);
router.get('/stats/users', adminController.getUserStats);

// Fraud detection settings
router.get('/fraud-detection/settings', adminController.getFraudDetectionSettings);

router.put('/fraud-detection/settings', [
  body('rateLimits').optional().isObject(),
  body('thresholds').optional().isObject()
], adminController.updateFraudDetectionSettings);

// System logs
router.get('/logs', [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('level').optional().isIn(['error', 'warn', 'info', 'debug'])
], adminController.getSystemLogs);

module.exports = router; 