// Frontend Security Utilities
import DOMPurify from 'dompurify';

/**
 * Sanitize user input to prevent XSS attacks
 */
export const sanitizeInput = (input: string): string => {
  if (typeof input !== 'string') {
    return String(input);
  }
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  });
};

/**
 * Validate email format
 */
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate PIN format (4 digits)
 */
export const validatePIN = (pin: string): boolean => {
  return /^\d{4}$/.test(pin);
};

/**
 * Validate MongoDB ObjectId format
 */
export const validateObjectId = (id: string): boolean => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};

/**
 * Sanitize and validate product name
 */
export const sanitizeProductName = (name: string): string => {
  const sanitized = sanitizeInput(name);
  return sanitized.trim().slice(0, 200); // Max 200 characters
};

/**
 * Sanitize and validate text input
 */
export const sanitizeText = (text: string, maxLength: number = 1000): string => {
  const sanitized = sanitizeInput(text);
  return sanitized.trim().slice(0, maxLength);
};

/**
 * Validate numeric input
 */
export const validateNumber = (value: any, min: number = 0, max?: number): boolean => {
  const num = Number(value);
  if (isNaN(num)) return false;
  if (num < min) return false;
  if (max !== undefined && num > max) return false;
  return true;
};

/**
 * Validate and sanitize quantity
 */
export const validateQuantity = (quantity: any): number | null => {
  const num = Number(quantity);
  if (isNaN(num) || num < 1 || !Number.isInteger(num)) {
    return null;
  }
  return num;
};

/**
 * Validate and sanitize price
 */
export const validatePrice = (price: any): number | null => {
  const num = Number(price);
  if (isNaN(num) || num < 0) {
    return null;
  }
  return Math.round(num * 100) / 100; // Round to 2 decimal places
};

/**
 * Escape HTML to prevent XSS
 */
export const escapeHtml = (text: string): string => {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
};

/**
 * Validate date format (ISO 8601)
 */
export const validateDate = (date: string): boolean => {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) return false;
  const d = new Date(date);
  return d instanceof Date && !isNaN(d.getTime());
};

/**
 * Rate limiting helper (client-side)
 */
export class ClientRateLimiter {
  private requests: Map<string, number[]> = new Map();
  private windowMs: number;
  private maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 10) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  canMakeRequest(key: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    
    // Remove old requests outside the window
    const validRequests = requests.filter(time => now - time < this.windowMs);
    
    if (validRequests.length >= this.maxRequests) {
      return false;
    }
    
    validRequests.push(now);
    this.requests.set(key, validRequests);
    return true;
  }

  reset(key: string): void {
    this.requests.delete(key);
  }
}

// Global rate limiter for API calls
export const apiRateLimiter = new ClientRateLimiter(60000, 30); // 30 requests per minute
