# Digital Wallet API Documentation

This document provides an overview of the Digital Wallet System's REST API endpoints and how to use them.

## Getting Started

### Base URL
All API endpoints are relative to the base URL:
```
http://localhost:3000/api
```

### Authentication
Most endpoints require authentication using a JWT token. After logging in or registering, include the token in the `Authorization` header of your requests:

```
Authorization: Bearer <your_token>
```

## Importing the Postman Collection

1. Download the `postman_collection.json` file
2. Open Postman
3. Click on "Import" button
4. Select the downloaded file
5. The collection will be imported with all requests, examples, and documentation

## API Endpoints

### Authentication

#### Register a New User
- **URL**: `/auth/register`
- **Method**: `POST`
- **Body**:
```json
{
  "username": "testuser",
  "email": "test@example.com",
  "password": "password123"
}
```
- **Success Response**: `201 Created`
```json
{
  "success": true,
  "message": "Registration successful",
  "user": {
    "id": 1,
    "username": "testuser",
    "email": "test@example.com"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Login
- **URL**: `/auth/login`
- **Method**: `POST`
- **Body**:
```json
{
  "email": "test@example.com",
  "password": "password123"
}
```
- **Success Response**: `200 OK`
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": 1,
    "username": "testuser",
    "email": "test@example.com"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Wallet Operations

#### Get Wallet Details
- **URL**: `/wallet`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <token>`
- **Success Response**: `200 OK`
```json
{
  "success": true,
  "wallet": {
    "id": 1,
    "balance": 75000,
    "currency": "INR",
    "isActive": true
  }
}
```

#### Deposit Funds
- **URL**: `/wallet/deposit`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer <token>`
- **Body**:
```json
{
  "amount": 5000
}
```
- **Success Response**: `200 OK`
```json
{
  "success": true,
  "message": "Amount credited successfully",
  "transaction": {
    "id": 101,
    "type": "deposit",
    "amount": 5000,
    "currency": "INR",
    "status": "completed",
    "createdAt": "2023-03-15T13:45:26.789Z"
  },
  "wallet": {
    "balance": 80000,
    "currency": "INR"
  }
}
```

#### Withdraw Funds
- **URL**: `/wallet/withdraw`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer <token>`
- **Body**:
```json
{
  "amount": 2000
}
```
- **Success Response**: `200 OK`
```json
{
  "success": true,
  "message": "Amount debited successfully",
  "transaction": {
    "id": 102,
    "type": "withdrawal",
    "amount": 2000,
    "currency": "INR",
    "status": "completed",
    "fraudScore": 0,
    "createdAt": "2023-03-15T13:50:15.123Z"
  },
  "wallet": {
    "balance": 78000,
    "currency": "INR"
  }
}
```

- **Error Response** (Fraud Detection): `400 Bad Request`
```json
{
  "success": false,
  "message": "Transaction flagged for suspicious activity",
  "details": {
    "fraudScore": 80,
    "reasons": [
      "Very large withdrawal amount: ₹50000",
      "Withdrawal of 64.10% of total balance"
    ]
  }
}
```

#### Transfer Funds
- **URL**: `/wallet/transfer`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer <token>`
- **Body**:
```json
{
  "recipientEmail": "recipient@example.com",
  "amount": 1000,
  "description": "Dinner payment"
}
```
- **Success Response**: `200 OK`
```json
{
  "success": true,
  "message": "Money sent successfully",
  "transaction": {
    "id": 103,
    "type": "transfer",
    "amount": 1000,
    "currency": "INR",
    "status": "completed",
    "fraudScore": 0,
    "createdAt": "2023-03-15T14:02:45.789Z",
    "recipient": {
      "id": 2,
      "username": "recipient"
    },
    "description": "Dinner payment"
  },
  "wallet": {
    "balance": 77000,
    "currency": "INR"
  }
}
```

- **Error Response** (Fraud Detection): `400 Bad Request`
```json
{
  "success": false,
  "message": "Transaction flagged for suspicious activity",
  "details": {
    "fraudScore": 70,
    "reasons": [
      "Very large transfer amount: ₹60000",
      "Withdrawal of 77.92% of total balance"
    ]
  }
}
```

#### Get Transaction History
- **URL**: `/wallet/transactions`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <token>`
- **Success Response**: `200 OK`
```json
{
  "success": true,
  "transactions": [
    {
      "id": 103,
      "type": "transfer",
      "amount": 1000,
      "currency": "INR",
      "status": "completed",
      "createdAt": "2023-03-15T14:02:45.789Z",
      "description": "Dinner payment",
      "sender": {
        "id": 1,
        "username": "testuser"
      },
      "recipient": {
        "id": 2,
        "username": "recipient"
      }
    },
    {
      "id": 102,
      "type": "withdrawal",
      "amount": 2000,
      "currency": "INR",
      "status": "completed",
      "createdAt": "2023-03-15T13:50:15.123Z",
      "description": "",
      "sender": {
        "id": 1,
        "username": "testuser"
      }
    },
    {
      "id": 101,
      "type": "deposit",
      "amount": 5000,
      "currency": "INR",
      "status": "completed",
      "createdAt": "2023-03-15T13:45:26.789Z",
      "description": "",
      "sender": {
        "id": 1,
        "username": "testuser"
      }
    }
  ]
}
```

### Admin Operations

#### Get Flagged Transactions (Admin Only)
- **URL**: `/admin/transactions/flagged`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <token>`
- **Success Response**: `200 OK`
```json
{
  "success": true,
  "transactions": [
    {
      "id": 105,
      "type": "withdrawal",
      "amount": 50000,
      "currency": "INR",
      "status": "blocked",
      "fraudScore": 80,
      "flagged": true,
      "flagReason": "Large withdrawal",
      "createdAt": "2023-03-15T15:10:23.456Z",
      "description": "",
      "sender": {
        "id": 3,
        "username": "user1",
        "email": "user1@example.com"
      },
      "recipient": null
    },
    {
      "id": 104,
      "type": "transfer",
      "amount": 60000,
      "currency": "INR",
      "status": "blocked",
      "fraudScore": 75,
      "flagged": true,
      "flagReason": "Suspicious activity",
      "createdAt": "2023-03-15T14:40:12.789Z",
      "description": "Large payment",
      "sender": {
        "id": 1,
        "username": "testuser",
        "email": "test@example.com"
      },
      "recipient": {
        "id": 2,
        "username": "recipient",
        "email": "recipient@example.com"
      }
    }
  ]
}
```

- **Error Response** (Access Denied): `403 Forbidden`
```json
{
  "success": false,
  "message": "Access denied"
}
```

## Fraud Detection Features

The API includes fraud detection for the following scenarios:

1. Multiple transfers in a short period
2. Sudden large withdrawals
3. Transfers to the same recipient multiple times
4. Transactions involving a high percentage of wallet balance
5. Large transaction amounts over defined thresholds:
   - Transfers: ₹50,000+ (alert), ₹100,000+ (higher fraud score)
   - Withdrawals: ₹25,000+ (alert), ₹75,000+ (higher fraud score)

Email alerts are automatically sent for:
- Transactions with a high fraud score
- Large transactions that exceed thresholds, even if allowed

## Testing

You can use the Postman collection to test all API endpoints. Remember to:

1. Register or login first to get an authentication token
2. Set up environment variables in Postman to store your token
3. Use the token for authenticated requests 