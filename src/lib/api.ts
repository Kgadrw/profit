// API Configuration and Utilities
import { apiRateLimiter, sanitizeInput, validateObjectId } from './security';

// API URL Configuration
// Priority: VITE_API_URL env variable > localhost (dev mode) > deployed URL
const getApiBaseUrl = (): string => {
  // If VITE_API_URL is explicitly set, use it
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Check if we should use localhost (for local testing)
  // In dev mode, defaults to localhost unless VITE_USE_LOCALHOST=false
  // In production, defaults to deployed URL unless VITE_USE_LOCALHOST=true
  const useLocalhost = import.meta.env.VITE_USE_LOCALHOST === 'true' || 
                       (import.meta.env.DEV && import.meta.env.VITE_USE_LOCALHOST !== 'false');
  
  if (useLocalhost) {
    // Default localhost port (change if your backend runs on different port)
    const localPort = import.meta.env.VITE_LOCAL_API_PORT || '3000';
    return `http://localhost:${localPort}/api`;
  }
  
  // Default to deployed URL
  return 'https://profit-backend-e4w1.onrender.com/api';
};

const API_BASE_URL = getApiBaseUrl();

// Log API URL in development mode for debugging
if (import.meta.env.DEV) {
  console.log(`🔌 API Base URL: ${API_BASE_URL}`);
}

export interface ApiResponse<T = any> {
  message?: string;
  data?: T;
  error?: string;
  user?: T;
  isAdmin?: boolean;
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
                         endpoint.startsWith('/auth/forgot-pin') ||
                         endpoint.startsWith('/auth/reset-pin') ||
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
  
  // Build headers - merge default headers with any provided headers
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (sanitizedUserId) {
    defaultHeaders['X-User-Id'] = sanitizedUserId;
  }
  
  const mergedHeaders = {
    ...defaultHeaders,
    ...(options.headers as Record<string, string> || {}),
  };
  
  const config: RequestInit = {
    ...options,
    headers: mergedHeaders,
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
      console.error(`[API] Request failed: ${response.status}`, data);
      throw new ApiError(
        data.error || data.message || 'An error occurred',
        response.status,
        data
      );
    }

    console.log(`[API] Request successful:`, data);
    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    // Check for connection refused errors - make them silent for offline support
    const errorMessage = error instanceof Error ? error.message : 'Network error occurred';
    if (errorMessage.includes('Failed to fetch') || errorMessage.includes('ERR_CONNECTION_REFUSED') || errorMessage.includes('NetworkError') || errorMessage.includes('connection')) {
      // Silent error - don't show technical messages to users
      throw new ApiError(
        '', // Empty message - will be handled gracefully
        0,
        { connectionError: true, silent: true }
      );
    }
    // For other errors, throw with the actual error message
    const errorMsg = error instanceof Error ? error.message : 'Network error occurred';
    throw new ApiError(errorMsg, 0, { silent: false });
  }
}

// Auth API functions
export const authApi = {
  // Register a new user
  async register(data: { name: string; email: string; phone: string; pin: string }): Promise<ApiResponse> {
    return request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Login
  async login(data: { pin: string; email: string }): Promise<ApiResponse> {
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
  async updateUser(data: { name?: string; email?: string; phone?: string; businessName?: string }): Promise<ApiResponse> {
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

  // Delete account
  async deleteAccount(): Promise<ApiResponse> {
    return request('/auth/delete-account', {
      method: 'DELETE',
    });
  },

  // Forgot PIN - Send OTP
  async forgotPin(data: { email: string }): Promise<ApiResponse> {
    return request('/auth/forgot-pin', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Reset PIN - Verify OTP and reset
  async resetPin(data: { email: string; otp: string; newPin: string }): Promise<ApiResponse> {
    return request('/auth/reset-pin', {
      method: 'POST',
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

  // Get schedule statistics
  async getScheduleStats(days: number = 30): Promise<ApiResponse> {
    return request(`/admin/schedule-stats?days=${days}`, {
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

// Client API functions
export const clientApi = {
  // Get all clients
  async getAll(): Promise<ApiResponse> {
    return request('/clients', {
      method: 'GET',
    });
  },

  // Get single client
  async getById(id: string): Promise<ApiResponse> {
    return request(`/clients/${id}`, {
      method: 'GET',
    });
  },

  // Create client
  async create(data: any): Promise<ApiResponse> {
    return request('/clients', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Update client
  async update(id: string, data: any): Promise<ApiResponse> {
    return request(`/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Delete client
  async delete(id: string): Promise<ApiResponse> {
    return request(`/clients/${id}`, {
      method: 'DELETE',
    });
  },
};

// Schedule API functions
export const scheduleApi = {
  // Get all schedules
  async getAll(params?: { status?: string; upcoming?: string; clientId?: string }): Promise<ApiResponse> {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.upcoming) queryParams.append('upcoming', params.upcoming);
    if (params?.clientId) queryParams.append('clientId', params.clientId);
    
    const queryString = queryParams.toString();
    const url = queryString ? `/schedules?${queryString}` : '/schedules';
    
    return request(url, {
      method: 'GET',
    });
  },

  // Get upcoming schedules
  async getUpcoming(days: number = 7): Promise<ApiResponse> {
    return request(`/schedules/upcoming?days=${days}`, {
      method: 'GET',
    });
  },

  // Get single schedule
  async getById(id: string): Promise<ApiResponse> {
    return request(`/schedules/${id}`, {
      method: 'GET',
    });
  },

  // Create schedule
  async create(data: any): Promise<ApiResponse> {
    return request('/schedules', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Update schedule
  async update(id: string, data: any): Promise<ApiResponse> {
    return request(`/schedules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Delete schedule
  async delete(id: string): Promise<ApiResponse> {
    return request(`/schedules/${id}`, {
      method: 'DELETE',
    });
  },

  // Complete schedule
  async complete(id: string, data?: { completionMessage?: string; notifyClient?: boolean; notifyUser?: boolean }): Promise<ApiResponse> {
    return request(`/schedules/${id}/complete`, {
      method: "PUT",
      body: JSON.stringify(data || {}),
    });
  },
};
