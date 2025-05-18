# Digital Wallet System API

A backend RESTful API for a digital wallet system with cash management, fraud detection capabilities, and email notifications.

## Overview

This is a backend-only system that provides a comprehensive API for digital wallet operations. It can be integrated with any frontend client, mobile app, or third-party service.

## Features

- **User Authentication & Session Management**
  - Secure user registration and login
  - JWT token-based authentication
  - Protected endpoints with middleware

- **Wallet Operations**
  - Deposit and withdraw funds
  - Transfer between users (even to non-registered email addresses)
  - Transaction history tracking
  - Automatic recipient account creation

- **Enhanced Fraud Detection**
  - Multiple transfers in short periods detection
  - Sudden large withdrawals identification
  - Transaction amount and frequency analysis
  - Percentage of balance withdrawals tracking
  - Configurable transaction thresholds
  - Fraud scoring system with customizable thresholds

- **Email Notification System**
  - Security alerts for suspicious transactions
  - Large transaction notifications
  - Formatted email templates with transaction details

- **Admin & Reporting APIs**
  - User management
  - Transaction monitoring
  - System statistics
  - Flagged transaction review

## Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: MySQL
- **Authentication**: JWT (JSON Web Tokens)
- **Validation**: Express Validator
- **Security**: Helmet, Rate Limiting, bcrypt

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- NPM or Yarn
- MySQL

### Installation

1. Clone the repository
   ```
   git clone https://github.com/SushyanthGIT2004/digital-wallet-system.git
   cd digital-wallet-system
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Start the API server
   ```
   npm start
   ```

4. For development with auto-reload
   ```
   npm run dev
   ```

5. To run the interactive CLI testing tool (in a separate terminal)
   ```
   npm run api-test
   ```

## API Documentation

Comprehensive API documentation is available in the `API_DOCUMENTATION.md` file. You can also use the Postman collection (`postman_collection.json`) to test all endpoints.

### Key Endpoints

#### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Authenticate user and get token

#### Wallet
- `GET /api/wallet` - Get wallet details
- `POST /api/wallet/deposit` - Deposit funds
- `POST /api/wallet/withdraw` - Withdraw funds
- `POST /api/wallet/transfer` - Transfer funds to another user
- `GET /api/wallet/transactions` - Get transaction history

#### Admin
- `GET /api/admin/transactions/flagged` - Get flagged transactions

## Fraud Detection Features

The system includes sophisticated fraud detection for the following scenarios:

1. **Multiple transfers in a short period** - Flags users making numerous transfers in minutes
2. **Sudden large withdrawals** - Detects withdrawals significantly larger than user's average
3. **Transfers to the same recipient multiple times** - Identifies potential suspicious patterns
4. **High percentage of wallet balance transactions** - Flags transactions using more than 70% of balance
5. **Large transaction thresholds**:
   - Transfers: ₹50,000+ (alert), ₹100,000+ (higher fraud score)
   - Withdrawals: ₹25,000+ (alert), ₹75,000+ (higher fraud score)

## Testing

The project includes several testing options:

1. **Postman Collection**: Use the provided collection to test all API endpoints
2. **CLI Testing Tool**: Run the interactive testing tool with `npm run api-test`
3. **Automated Tests**: Run tests using Jest with `npm test`

## Client Integration

This is a backend-only API that can be integrated with any client application:

1. Use the API documentation to understand available endpoints
2. Implement authentication flow (register/login) to obtain JWT token
3. Include the JWT token in the Authorization header for protected endpoints
4. Handle API responses appropriately in your client application

## License

This project is licensed under the MIT License. 
