const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Wallet = sequelize.define('Wallet', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    balance: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'USD'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    lastTransaction: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    timestamps: true,
    paranoid: true, // This enables soft deletes
    
    // Getters and setters
    getterMethods: {
      formattedBalance() {
        return `${parseFloat(this.balance).toFixed(2)} ${this.currency}`;
      }
    }
  });

  // Instance methods
  Wallet.prototype.deposit = async function(amount) {
    if (amount <= 0) {
      throw new Error('Deposit amount must be positive');
    }
    
    this.balance = parseFloat(this.balance) + parseFloat(amount);
    this.lastTransaction = new Date();
    return await this.save();
  };

  Wallet.prototype.withdraw = async function(amount) {
    if (amount <= 0) {
      throw new Error('Withdrawal amount must be positive');
    }
    
    if (parseFloat(this.balance) < parseFloat(amount)) {
      throw new Error('Insufficient funds');
    }
    
    this.balance = parseFloat(this.balance) - parseFloat(amount);
    this.lastTransaction = new Date();
    return await this.save();
  };

  Wallet.prototype.isDeleted = function() {
    return this.deletedAt !== null;
  };
  
  return Wallet;
}; 