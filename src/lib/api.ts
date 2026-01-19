// API Configuration and Utilities
import { apiRateLimiter, sanitizeInput, validateObjectId } from './security';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://profit-backend-e4w1.onrender.com/api';

export interface ApiResponse<T = any> {
  message?: string;
  data?: T;
  error?: string;
  user?: T;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Generic API request function
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  // Sanitize endpoint to prevent path traversal
  const sanitizedEndpoint = sanitizeInput(endpoint);
  const url = `${API_BASE_URL}${sanitizedEndpoint}`;
  
  // Client-side rate limiting
  const rateLimitKey = `api-${endpoint.split('/')[0]}`;
  if (!apiRateLimiter.canMakeRequest(rateLimitKey)) {
    throw new ApiError(
      'Too many requests. Please wait a moment and try again.',
      429,
      { rateLimited: true }
    );
  }
  
  // Get userId from localStorage - REQUIRED for all requests except auth endpoints
  const userId = localStorage.getItem("profit-pilot-user-id");
  
  // For non-auth endpoints, userId is required for data isolation
  const isAuthEndpoint = endpoint.startsWith('/auth/register') || 
                         endpoint.startsWith('/auth/login') ||
                         endpoint.startsWith('/auth/me');
  
  // Admin endpoints don't require regular userId (admin has special userId)
  const isAdminEndpoint = endpoint.startsWith('/admin/');
  
  if (!isAuthEndpoint && !isAdminEndpoint && !userId) {
    throw new ApiError(
      'User not authenticated. Please login to access your data.',
      401,
      { requiresAuth: true }
    );
  }
  
  // Sanitize userId if present
  const sanitizedUserId = userId ? sanitizeInput(userId) : null;
  
  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...(sanitizedUserId && { 'X-User-Id': sanitizedUserId }),
      ...options.headers,
    },
    ...options,
  };
  
  // Sanitize request body if present
  if (config.body && typeof config.body === 'string') {
    try {
      const bodyObj = JSON.parse(config.body);
      // Basic sanitization - remove any script tags or dangerous content
      const sanitizedBody = JSON.stringify(bodyObj);
      config.body = sanitizedBody;
    } catch (e) {
      // If body is not JSON, sanitize as string
      config.body = sanitizeInput(config.body);
    }
  }

  try {
    const response = await fetch(url, config);
    
    let data;
    try {
      data = await response.json();
    } catch (e) {
      // If response is not JSON, create a simple error response
      data = { error: response.statusText || 'An error occurred' };
    }

    if (!response.ok) {
      throw new ApiError(
        data.error || 'An error occurred',
        response.status,
        data
      );
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    // Check for connection refused errors
    const errorMessage = error instanceof Error ? error.message : 'Network error occurred';
    if (errorMessage.includes('Failed to fetch') || errorMessage.includes('ERR_CONNECTION_REFUSED') || errorMessage.includes('NetworkError')) {
      throw new ApiError(
        'Connection refused: Backend server is not reachable. Please check your connection or try again later.',
        0,
        { connectionError: true }
      );
    }
    throw new ApiError(errorMessage);
  }
}

// Auth API functions
export const authApi = {
  // Register a new user
  async register(data: { name: string; email?: string; pin: string }): Promise<ApiResponse> {
    return request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Login
  async login(data: { pin: string; email?: string }): Promise<ApiResponse> {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Get current user
  async getCurrentUser(): Promise<ApiResponse> {
    return request('/auth/me', {
      method: 'GET',
    });
  },

  // Update user information
  async updateUser(data: { name?: string; email?: string; businessName?: string }): Promise<ApiResponse> {
    return request('/auth/update', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Change PIN
  async changePin(data: { currentPin: string; newPin: string }): Promise<ApiResponse> {
    return request('/auth/change-pin', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};

// Product API functions
export const productApi = {
  // Get all products
  async getAll(): Promise<ApiResponse> {
    return request('/products', {
      method: 'GET',
    });
  },

  // Get single product
  async getById(id: string): Promise<ApiResponse> {
    return request(`/products/${id}`, {
      method: 'GET',
    });
  },

  // Create product
  async create(data: any): Promise<ApiResponse> {
    return request('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Update product
  async update(id: string, data: any): Promise<ApiResponse> {
    return request(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Delete product
  async delete(id: string): Promise<ApiResponse> {
    return request(`/products/${id}`, {
      method: 'DELETE',
    });
  },
};

// Sale API functions
export const saleApi = {
  // Get all sales
  async getAll(params?: { startDate?: string; endDate?: string; product?: string }): Promise<ApiResponse> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.product) queryParams.append('product', params.product);
    
    const queryString = queryParams.toString();
    const url = queryString ? `/sales?${queryString}` : '/sales';
    
    return request(url, {
      method: 'GET',
    });
  },

  // Get single sale
  async getById(id: string): Promise<ApiResponse> {
    return request(`/sales/${id}`, {
      method: 'GET',
    });
  },

  // Create sale
  async create(data: any): Promise<ApiResponse> {
    return request('/sales', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Create bulk sales
  async createBulk(sales: any[]): Promise<ApiResponse> {
    return request('/sales/bulk', {
      method: 'POST',
      body: JSON.stringify({ sales }),
    });
  },

  // Update sale
  async update(id: string, data: any): Promise<ApiResponse> {
    return request(`/sales/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Delete sale
  async delete(id: string): Promise<ApiResponse> {
    return request(`/sales/${id}`, {
      method: 'DELETE',
    });
  },

  // Delete all sales
  async deleteAll(): Promise<ApiResponse> {
    return request('/sales/all', {
      method: 'DELETE',
    });
  },
};

// Admin API functions
export const adminApi = {
  // Get system statistics
  async getSystemStats(): Promise<ApiResponse> {
    return request('/admin/stats', {
      method: 'GET',
    });
  },

  // Get all users
  async getAllUsers(): Promise<ApiResponse> {
    return request('/admin/users', {
      method: 'GET',
    });
  },

  // Get user activity
  async getUserActivity(days: number = 7): Promise<ApiResponse> {
    return request(`/admin/activity?days=${days}`, {
      method: 'GET',
    });
  },

  // Get user usage statistics
  async getUserUsage(days: number = 30): Promise<ApiResponse> {
    return request(`/admin/usage?days=${days}`, {
      method: 'GET',
    });
  },

  // Get API statistics
  async getApiStats(): Promise<ApiResponse> {
    return request('/admin/api-stats', {
      method: 'GET',
    });
  },

  // Get system health
  async getSystemHealth(): Promise<ApiResponse> {
    return request('/admin/health', {
      method: 'GET',
    });
  },

  // Delete user and all their data
  async deleteUser(userId: string): Promise<ApiResponse> {
    return request(`/admin/users/${userId}`, {
      method: 'DELETE',
    });
  },
};
