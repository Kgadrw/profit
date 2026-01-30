// Request Deduplication and Coalescing
// Prevents duplicate requests and coalesces multiple identical requests into one

interface PendingRequest {
  promise: Promise<any>;
  timestamp: number;
  abortController: AbortController;
}

class RequestDeduplicator {
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private readonly REQUEST_TIMEOUT = 30000; // 30 seconds
  private readonly CLEANUP_INTERVAL = 60000; // Clean up every minute

  constructor() {
    // Clean up stale requests periodically
    setInterval(() => {
      this.cleanup();
    }, this.CLEANUP_INTERVAL);
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, request] of this.pendingRequests.entries()) {
      if (now - request.timestamp > this.REQUEST_TIMEOUT) {
        request.abortController.abort();
        this.pendingRequests.delete(key);
      }
    }
  }

  // Generate a unique key for a request
  private generateKey(endpoint: string, method: string, body?: any): string {
    const bodyStr = body ? JSON.stringify(body) : '';
    return `${method}:${endpoint}:${bodyStr}`;
  }

  // Execute a request with deduplication
  async execute<T>(
    endpoint: string,
    method: string,
    fetchFn: (signal: AbortSignal) => Promise<T>,
    body?: any
  ): Promise<T> {
    const key = this.generateKey(endpoint, method, body);
    const now = Date.now();

    // Check if there's already a pending request
    const existing = this.pendingRequests.get(key);
    if (existing) {
      // Check if it's still valid (not too old)
      if (now - existing.timestamp < this.REQUEST_TIMEOUT) {
        // Return the existing promise
        return existing.promise;
      } else {
        // Abort the old request and create a new one
        existing.abortController.abort();
        this.pendingRequests.delete(key);
      }
    }

    // Create a new request
    const abortController = new AbortController();
    const promise = fetchFn(abortController.signal)
      .then((result) => {
        // Remove from pending requests on success
        this.pendingRequests.delete(key);
        return result;
      })
      .catch((error) => {
        // Remove from pending requests on error
        this.pendingRequests.delete(key);
        throw error;
      });

    this.pendingRequests.set(key, {
      promise,
      timestamp: now,
      abortController
    });

    return promise;
  }

  // Cancel a specific request
  cancel(endpoint: string, method: string, body?: any) {
    const key = this.generateKey(endpoint, method, body);
    const request = this.pendingRequests.get(key);
    if (request) {
      request.abortController.abort();
      this.pendingRequests.delete(key);
    }
  }

  // Cancel all pending requests
  cancelAll() {
    for (const request of this.pendingRequests.values()) {
      request.abortController.abort();
    }
    this.pendingRequests.clear();
  }
}

export const requestDeduplicator = new RequestDeduplicator();
