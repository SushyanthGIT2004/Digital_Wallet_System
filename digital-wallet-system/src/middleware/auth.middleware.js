const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

/**
 * Middleware to protect routes that require authentication
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const protect = async (req, res, next) => {
  try {
    // 1) Get token from authorization header
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'You are not logged in. Please log in to get access.'
      });
    }

    // 2) Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3) Check if user still exists
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'The user belonging to this token no longer exists.'
      });
    }

    // 4) Check if user is deleted or inactive
    if (user.deletedAt !== null || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'This account has been deactivated.'
      });
    }

    // 5) Grant access to protected route
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid token. Please log in again.'
    });
  }
};

/**
 * Middleware to restrict access based on user role
 * @param {String|Array} roles - Roles allowed to access this route
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action'
      });
    }
    next();
  };
};

module.exports = {
  protect,
  restrictTo
}; 