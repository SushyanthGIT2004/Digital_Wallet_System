const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const Wallet = require('../models/wallet.model');
const { validationResult } = require('express-validator');

/**
 * Generate JWT token for user
 * @param {Object} user - User object
 * @returns {String} JWT token
 */
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET || 'your_jwt_secret_key_here',
    { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
  );
};

/**
 * Register a new user
 * @route POST /api/auth/register
 */
exports.register = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { username, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email or username'
      });
    }

    // Create new user
    const user = await User.create({
      username,
      email,
      password,
      lastLogin: new Date()
    });

    // Create a wallet for the user
    await Wallet.create({
      user: user._id,
      balance: 0,
      currency: 'USD'
    });

    // Generate token
    const token = generateToken(user);

    res.status(201).json({
      success: true,
      token,
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error registering user',
      error: error.message
    });
  }
};

/**
 * Login user
 * @route POST /api/auth/login
 */
exports.login = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user is deleted or inactive
    if (user.deletedAt !== null || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'This account has been deactivated'
      });
    }

    // Check if password is correct
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    // Generate token
    const token = generateToken(user);

    res.status(200).json({
      success: true,
      token,
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error logging in',
      error: error.message
    });
  }
};

/**
 * Get current user profile
 * @route GET /api/auth/profile
 */
exports.getCurrentUser = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        user: {
          id: req.user._id,
          username: req.user.username,
          email: req.user.email,
          role: req.user.role,
          createdAt: req.user.createdAt,
          lastLogin: req.user.lastLogin
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error getting user profile',
      error: error.message
    });
  }
};

/**
 * Update user profile
 * @route PUT /api/auth/profile
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

    const { username, email } = req.body;
    const updates = {};

    if (username) updates.username = username;
    if (email) updates.email = email;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating user profile',
      error: error.message
    });
  }
};

/**
 * Change password
 * @route POST /api/auth/change-password
 */
exports.changePassword = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await User.findById(req.user._id).select('+password');

    // Check if current password is correct
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error changing password',
      error: error.message
    });
  }
};

/**
 * Logout user
 * @route POST /api/auth/logout
 */
exports.logout = (req, res) => {
  // In a stateless JWT system, logout is handled client-side
  // by removing the token from storage
  
  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
}; 