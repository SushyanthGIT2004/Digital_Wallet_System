/**
 * Email Service Utility for Digital Wallet System
 * This is a mock implementation for sending email alerts
 */

/**
 * Send an email alert
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} body - Email body content
 * @returns {Promise<object>} - Result of the email sending operation
 */
const sendEmail = (to, subject, body) => {
  return new Promise((resolve) => {
    // Log the email details (mock implementation)
    console.log('\n========== EMAIL ALERT ==========');
    console.log(`RECIPIENT: ${to}`);
    console.log(`SUBJECT: ${subject}`);
    console.log(`BODY: ${body}`);
    console.log('===============================\n');
    
    // Simulate a delay as if actually sending an email
    setTimeout(() => {
      resolve({
        success: true,
        messageId: `mock_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
        timestamp: new Date().toISOString()
      });
    }, 500);
  });
};

/**
 * Send a security alert email for suspicious transactions
 * @param {object} transaction - Transaction details
 * @param {object} sender - Sender user details
 * @param {string} reason - Reason for the alert
 * @returns {Promise<object>} - Result of the email sending operation
 */
const sendSecurityAlert = async (transaction, sender, reason) => {
  const subject = `🚨 Security Alert: Suspicious Transaction Detected`;
  
  const body = `
Dear ${sender.username},

We've detected a potentially suspicious transaction on your account:

Transaction Details:
- Type: ${transaction.type}
- Amount: ₹${transaction.amount}
- Date: ${new Date(transaction.timestamp || Date.now()).toLocaleString()}
- Transaction ID: ${transaction.id || 'N/A'}

Reason for alert: ${reason}

If you did not authorize this transaction, please contact our support team immediately.

Security Team
Digital Wallet System
`;

  // Send only to the user
  console.log("\n===== SENDING USER SECURITY ALERT =====");
  await sendEmail(sender.email, subject, body);
  
  return { success: true };
};

/**
 * Send a large transaction notification
 * @param {object} transaction - Transaction details
 * @param {object} sender - Sender user details
 * @param {object} recipient - Recipient user details (optional)
 * @returns {Promise<object>} - Result of the email sending operation
 */
const sendLargeTransactionAlert = async (transaction, sender, recipient = null) => {
  const subject = `Large Transaction Notification`;
  
  let recipientInfo = '';
  if (recipient && transaction.type === 'transfer') {
    recipientInfo = `
Recipient: ${recipient.username} (${recipient.email})`;
  }
  
  const body = `
Dear ${sender.username},

A large transaction has been processed on your account:

Transaction Details:
- Type: ${transaction.type}
- Amount: ₹${transaction.amount}
- Date: ${new Date(transaction.timestamp || Date.now()).toLocaleString()}
- Transaction ID: ${transaction.id || 'N/A'}${recipientInfo}

This is an automated notification for your security. If you did not authorize this transaction, 
please contact our support team immediately.

Digital Wallet System
`;

  // Clearly labeled user alert
  console.log("\n===== SENDING USER LARGE TRANSACTION ALERT =====");
  await sendEmail(sender.email, subject, body);
  
  return { success: true };
};

module.exports = {
  sendEmail,
  sendSecurityAlert,
  sendLargeTransactionAlert
}; 