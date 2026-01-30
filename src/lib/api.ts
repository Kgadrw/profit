// API Configuration and Utilities
import { sanitizeInput, validateObjectId } from './security';
import { logger } from './logger';

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

// Log API URL in development mode for debugging (disabled for privacy/security)
// logger.log(`🔌 API Base URL: ${API_BASE_URL}`);

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

// Request cache to prevent duplicate requests
const requestCache = new Map<string, { promise: Promise<ApiResponse<any>>; timestamp: number }>();
const CACHE_TTL = 1000; // 1 second cache for GET requests

// Generic API request function with retry logic for rate limiting
async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  retryCount: number = 0
): Promise<ApiResponse<T>> {
  // Sanitize endpoint to prevent path traversal
  const sanitizedEndpoint = sanitizeInput(endpoint);
  const url = `${API_BASE_URL}${sanitizedEndpoint}`;
  
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
    // Check cache for GET requests (deduplication)
    const isGet = (options.method || 'GET').toUpperCase() === 'GET';
    const cacheKey = `${options.method || 'GET'}:${endpoint}`;
    
    if (isGet && retryCount === 0) {
      const cached = requestCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.promise;
      }
    }

    // Create request promise
    const requestPromise = (async () => {
      const response = await fetch(url, config);
      
      let data;
      try {
        data = await response.json();
      } catch (e) {
        // If response is not JSON, create a simple error response
        data = { error: response.statusText || 'An error occurred' };
      }

      if (!response.ok) {
        // Handle 429 Too Many Requests with retry logic
        if (response.status === 429 && retryCount < 3) {
          // Get retry-after from header or response data, default to exponential backoff
          const retryAfterHeader = response.headers.get('Retry-After');
          const retryAfter = retryAfterHeader || 
                            data.retryAfter || 
                            Math.min(1000 * Math.pow(2, retryCount), 30000); // Max 30 seconds
          
          const waitTime = typeof retryAfter === 'string' ? parseInt(retryAfter) * 1000 : retryAfter;
          
          // Add jitter to prevent thundering herd
          const jitter = Math.random() * 0.25 * waitTime;
          const totalWait = Math.min(waitTime + jitter, 30000);
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, totalWait));
          
          // Retry the request
          return request<T>(endpoint, options, retryCount + 1);
        }
        
        // logger.error(`[API] Request failed: ${response.status}`, data);
        throw new ApiError(
          data.error || data.message || 'An error occurred',
          response.status,
          { ...data, retryAfter: response.headers.get('Retry-After') }
        );
      }

      // logger.log(`[API] Request successful:`, data);
      return data;
    })();

    // Cache GET requests
    if (isGet && retryCount === 0) {
      requestCache.set(cacheKey, {
        promise: requestPromise as Promise<ApiResponse<any>>,
        timestamp: Date.now()
      });
      
      // Clean up cache after TTL
      setTimeout(() => {
        requestCache.delete(cacheKey);
      }, CACHE_TTL);
    }

    return requestPromise;
  } catch (error) {
    if (error instanceof ApiError) {
      // Retry 429 errors with exponential backoff
      if (error.status === 429 && retryCount < 3) {
        const waitTime = error.response?.retryAfter 
          ? (typeof error.response.retryAfter === 'string' ? parseInt(error.response.retryAfter) * 1000 : error.response.retryAfter)
          : Math.min(1000 * Math.pow(2, retryCount), 30000); // Max 30 seconds
        
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return request<T>(endpoint, options, retryCount + 1);
      }
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
  // Get all sales - fetch ALL sales for the user from database
  async getAll(params?: { startDate?: string; endDate?: string; product?: string }): Promise<ApiResponse> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.product) queryParams.append('product', params.product);
    
    // Ensure we get ALL sales - no limit
    queryParams.append('limit', '0'); // 0 means no limit
    queryParams.append('skip', '0');
    
    const queryString = queryParams.toString();
    const url = queryString ? `/sales?${queryString}` : '/sales?limit=0&skip=0';
    
    // logger.log('[saleApi] Fetching ALL sales from database:', url);
    
    try {
      const response = await request(url, {
        method: 'GET',
      });
      
      // logger.log('[saleApi] Sales fetched from database:', {
      //   count: Array.isArray(response?.data) ? response.data.length : 0,
      //   hasData: !!response?.data,
      //   responseKeys: response ? Object.keys(response) : [],
      // });
      
      // if (response?.data && Array.isArray(response.data)) {
      //   logger.log(`[saleApi] ✓ Successfully fetched ${response.data.length} sale(s) from database`);
      // }
      
      return response;
    } catch (error: any) {
      // logger.error('[saleApi] ✗ Error fetching sales from database:', error);
      throw error;
    }
  },

  // Get single sale
  async getById(id: string): Promise<ApiResponse> {
    return request(`/sales/${id}`, {
      method: 'GET',
    });
  },

  // Create sale - Direct API call to server
  // Note: Offline handling is done at the useApi hook level
  async create(data: any): Promise<ApiResponse> {
    // logger.log('[saleApi] ===== DIRECT API CALL: Creating sale =====');
    // logger.log('[saleApi] Sale data:', JSON.stringify(data, null, 2));
    // logger.log('[saleApi] API URL:', `${API_BASE_URL}/sales`);
    // logger.log('[saleApi] Online status:', navigator.onLine);
    
    try {
      const response = await request('/sales', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      
      if (!response || (!response.data && !response)) {
        // logger.error('[saleApi] ✗ Invalid response structure:', response);
        throw new Error('Invalid response from sales API. Please try again.');
      }
      
      // logger.log('[saleApi] ✓ Sale created successfully via DIRECT API:', response);
      return response;
    } catch (error: any) {
      // logger.error('[saleApi] ✗ Error creating sale via DIRECT API:', error);
      // Re-throw with connection error flag if it's a network error
      // This allows the useApi hook to handle offline scenarios properly
      if (!navigator.onLine || 
          error?.message?.includes('Failed to fetch') ||
          error?.message?.includes('NetworkError') ||
          error?.message?.includes('Network request failed') ||
          error?.message?.includes('connection')) {
        const connectionError: any = new Error('Network error: Unable to connect to server.');
        connectionError.response = { connectionError: true };
        throw connectionError;
      }
      throw error;
    }
  },

  // Create bulk sales - Direct API call to server (no offline storage, no syncing)
  async createBulk(sales: any[]): Promise<ApiResponse> {
    // logger.log('[saleApi] ===== DIRECT API CALL: Creating bulk sales =====');
    // logger.log('[saleApi] Sales count:', sales.length);
    // logger.log('[saleApi] Sales data:', JSON.stringify(sales, null, 2));
    // logger.log('[saleApi] API URL:', `${API_BASE_URL}/sales/bulk`);
    // logger.log('[saleApi] Online status:', navigator.onLine);
    
    if (!navigator.onLine) {
      const error: any = new Error('Cannot record sales while offline. Please check your internet connection.');
      error.response = { connectionError: true };
      throw error;
    }
    
    if (!sales || sales.length === 0) {
      throw new Error('No sales data provided for bulk creation.');
    }
    
    try {
      const response = await request('/sales/bulk', {
        method: 'POST',
        body: JSON.stringify({ sales }),
      });
      
      if (!response || (!response.data && !response)) {
        // logger.error('[saleApi] ✗ Invalid bulk response structure:', response);
        throw new Error('Invalid response from bulk sales API. Please try again.');
      }
      
      // logger.log('[saleApi] ✓ Bulk sales created successfully via DIRECT API:', response);
      return response;
    } catch (error: any) {
      // logger.error('[saleApi] ✗ Error creating bulk sales via DIRECT API:', error);
      // Re-throw with connection error flag if it's a network error
      if (!navigator.onLine || 
          error?.message?.includes('Failed to fetch') ||
          error?.message?.includes('NetworkError') ||
          error?.message?.includes('Network request failed')) {
        const connectionError: any = new Error('Cannot record sales while offline. Please check your internet connection.');
        connectionError.response = { connectionError: true };
        throw connectionError;
      }
      throw error;
    }
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
