// Database configuration 
module.exports = {
  database: {
    dialect: 'sqlite',
    storage: './database.sqlite', // SQLite database file path
    logging: process.env.NODE_ENV === 'development'
  },
  server: {
    port: process.env.PORT || 3000
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your_jwt_secret_key',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d'
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100
  }
}; 