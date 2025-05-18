const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');
const config = require('../../config');

// Load environment variables
dotenv.config();

// Create Sequelize instance with SQLite
const sequelize = new Sequelize({
  dialect: config.database.dialect,
  storage: config.database.storage,
  logging: config.database.logging
});

// Import models
const User = require('./user.model')(sequelize);
const Wallet = require('./wallet.model')(sequelize);
const Transaction = require('./transaction.model')(sequelize);

// Define associations
User.hasOne(Wallet, {
  foreignKey: 'userId',
  as: 'wallet',
  onDelete: 'CASCADE'
});
Wallet.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

User.hasMany(Transaction, {
  foreignKey: 'senderId',
  as: 'sentTransactions'
});
Transaction.belongsTo(User, {
  foreignKey: 'senderId',
  as: 'sender'
});

User.hasMany(Transaction, {
  foreignKey: 'recipientId',
  as: 'receivedTransactions'
});
Transaction.belongsTo(User, {
  foreignKey: 'recipientId',
  as: 'recipient'
});

User.hasMany(Transaction, {
  foreignKey: 'reviewedById',
  as: 'reviewedTransactions'
});
Transaction.belongsTo(User, {
  foreignKey: 'reviewedById',
  as: 'reviewedBy'
});

// Export models and sequelize instance
module.exports = {
  sequelize,
  User,
  Wallet,
  Transaction
}; 