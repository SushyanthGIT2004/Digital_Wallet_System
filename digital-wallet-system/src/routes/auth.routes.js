const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

// Import controllers
const authController = require('../controllers/auth.controller');

// Import middleware
const authMiddleware = require('../middleware/auth.middleware');

// Register a new user
router.post('/register', [
  body('username').isString().isLength({ min: 3, max: 20 }).trim(),
  body('email').isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
], authController.register);

// Login user
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').isString().notEmpty()
], authController.login);

// Get current user profile
router.get('/profile', authMiddleware.protect, authController.getCurrentUser);

// Update user profile
router.put('/profile', [
  authMiddleware.protect,
  body('username').optional().isString().isLength({ min: 3, max: 20 }).trim(),
  body('email').optional().isEmail().normalizeEmail()
], authController.updateUser);

// Change password
router.post('/change-password', [
  authMiddleware.protect,
  body('currentPassword').isString().notEmpty(),
  body('newPassword').isString().isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
], authController.changePassword);

// Logout user (invalidate token)
router.post('/logout', authMiddleware.protect, authController.logout);

module.exports = router; 