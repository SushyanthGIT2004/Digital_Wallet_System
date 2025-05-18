const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Transaction = sequelize.define('Transaction', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    senderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    recipientId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0.01
      }
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'USD'
    },
    type: {
      type: DataTypes.ENUM('deposit', 'withdrawal', 'transfer'),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('pending', 'completed', 'failed', 'flagged'),
      defaultValue: 'pending'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    reference: {
      type: DataTypes.STRING,
      unique: true
    },
    metadata: {
      type: DataTypes.JSON,
      defaultValue: {}
    },
    fraudScore: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: 0,
        max: 100
      }
    },
    flagged: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    flagReason: {
      type: DataTypes.STRING,
      allowNull: true
    },
    reviewedById: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    timestamps: true,
    paranoid: true, // This enables soft deletes
    hooks: {
      beforeCreate: async (transaction) => {
        if (!transaction.reference) {
          // Generate a unique reference
          const date = new Date();
          const timestamp = date.getTime();
          const random = Math.floor(Math.random() * 1000);
          transaction.reference = `TRX-${timestamp}-${random}`;
        }
      }
    }
  });

  // Instance methods
  Transaction.prototype.flag = async function(reason) {
    this.flagged = true;
    this.status = 'flagged';
    this.flagReason = reason || 'Suspicious activity detected';
    return await this.save();
  };

  Transaction.prototype.complete = async function() {
    this.status = 'completed';
    return await this.save();
  };

  Transaction.prototype.fail = async function(reason) {
    this.status = 'failed';
    this.metadata = JSON.stringify({
      ...JSON.parse(this.metadata || '{}'),
      failureReason: reason || 'Transaction failed'
    });
    return await this.save();
  };

  Transaction.prototype.isDeleted = function() {
    return this.deletedAt !== null;
  };

  return Transaction;
}; 