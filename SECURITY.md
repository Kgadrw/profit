# Security Documentation

This document outlines the comprehensive security measures implemented in the Profit Pilot platform.

## Backend Security

### 1. Authentication & Authorization
- **User Authentication**: All protected routes require valid `X-User-Id` header
- **Admin Authentication**: Admin routes require special admin authentication
- **PIN Security**: PINs are hashed using bcrypt with salt rounds of 10
- **Session Management**: User sessions are validated on every request

### 2. Input Validation & Sanitization
- **express-validator**: All inputs are validated using express-validator
- **MongoDB Injection Prevention**: express-mongo-sanitize prevents NoSQL injection
- **XSS Protection**: xss-clean sanitizes all inputs to prevent XSS attacks
- **HTTP Parameter Pollution**: hpp middleware prevents parameter pollution attacks

### 3. Rate Limiting
- **General API**: 100 requests per 15 minutes per IP
- **Authentication Endpoints**: 5 requests per 15 minutes per IP (strict)
- **Admin Endpoints**: 20 requests per minute per IP (strict)

### 4. Security Headers
- **Helmet.js**: Implements security headers including:
  - Content Security Policy (CSP)
  - XSS Protection
  - Strict Transport Security (HSTS)
  - Frame Options
  - Content Type Options

### 5. CORS Configuration
- Configured to allow only specified origins
- Credentials support enabled
- Specific methods and headers allowed

### 6. Error Handling
- Errors don't leak sensitive information
- Stack traces only shown in development mode
- Generic error messages for production

### 7. Request Size Limits
- JSON payloads limited to 10MB
- URL-encoded payloads limited to 10MB

## Frontend Security

### 1. Input Sanitization
- **DOMPurify**: All user inputs are sanitized before processing
- **XSS Prevention**: HTML escaping for all user-generated content
- **Input Validation**: Client-side validation for all forms

### 2. API Security
- **Rate Limiting**: Client-side rate limiting (30 requests per minute)
- **Request Sanitization**: All API requests are sanitized
- **Authentication Headers**: Secure transmission of user IDs

### 3. Data Validation
- Email format validation
- PIN format validation (4 digits)
- MongoDB ObjectId validation
- Numeric input validation
- Date format validation

### 4. Content Security
- XSS protection through input sanitization
- HTML escaping for display
- Safe handling of user-generated content

## Security Best Practices

### 1. PIN Security
- PINs are never stored in plain text
- PINs are hashed using bcrypt
- PIN comparison uses secure comparison methods
- PIN validation on both client and server

### 2. Data Isolation
- Each user's data is isolated by userId
- No cross-user data access
- User ID validation on every request
- Admin access requires special authentication

### 3. API Security
- All endpoints require authentication (except auth endpoints)
- User ID validation on every request
- Input validation on all endpoints
- Rate limiting to prevent abuse

### 4. Error Handling
- No sensitive information in error messages
- Generic error messages for users
- Detailed logging server-side only

## Security Checklist

- ✅ Input validation and sanitization
- ✅ XSS protection
- ✅ NoSQL injection prevention
- ✅ SQL injection prevention (N/A - using MongoDB)
- ✅ Rate limiting
- ✅ Authentication middleware
- ✅ Authorization checks
- ✅ Security headers
- ✅ CORS configuration
- ✅ Error handling
- ✅ PIN hashing
- ✅ Request size limits
- ✅ Client-side rate limiting
- ✅ Content Security Policy

## Reporting Security Issues

If you discover a security vulnerability, please report it responsibly:
1. Do not open a public issue
2. Contact the development team directly
3. Provide detailed information about the vulnerability
4. Allow time for the issue to be addressed before public disclosure

## Security Updates

Security measures are continuously reviewed and updated. Regular security audits are recommended to ensure the platform remains secure.
