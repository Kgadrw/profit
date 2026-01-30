// Request Queue with Exponential Backoff and Jitter
// Manages request retries with intelligent backoff strategies

interface QueuedRequest {
  endpoint: string;
  method: string;
  options: RequestInit;
  retryCount: number;
  maxRetries: number;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  timestamp: number;
}

class RequestQueue {
  private queue: QueuedRequest[] = [];
  private processing = false;
  private readonly MAX_CONCURRENT = 5; // Max concurrent requests
  private readonly BASE_DELAY = 1000; // 1 second base delay
  private readonly MAX_DELAY = 30000; // 30 seconds max delay
  private activeRequests = 0;

  // Calculate exponential backoff with jitter
  private calculateBackoff(retryCount: number, retryAfter?: number): number {
    if (retryAfter) {
      // Respect server's Retry-After header
      return Math.min(retryAfter * 1000, this.MAX_DELAY);
    }

    // Exponential backoff: base * 2^retryCount
    const exponential = this.BASE_DELAY * Math.pow(2, retryCount);
    
    // Add jitter (random 0-25% of the delay)
    const jitter = Math.random() * 0.25 * exponential;
    
    return Math.min(exponential + jitter, this.MAX_DELAY);
  }

  // Process the queue
  private async processQueue() {
    if (this.processing || this.activeRequests >= this.MAX_CONCURRENT) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0 && this.activeRequests < this.MAX_CONCURRENT) {
      const request = this.queue.shift();
      if (!request) break;

      this.activeRequests++;
      
      // Process request asynchronously
      this.executeRequest(request).finally(() => {
        this.activeRequests--;
        // Continue processing queue
        setTimeout(() => this.processQueue(), 0);
      });
    }

    this.processing = false;
  }

  // Execute a single request
  private async executeRequest(request: QueuedRequest) {
    try {
      const response = await fetch(request.endpoint, {
        ...request.options,
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      if (!response.ok) {
        // Handle 429 Too Many Requests
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const retryAfterSeconds = retryAfter ? parseInt(retryAfter) : undefined;
          
          if (request.retryCount < request.maxRetries) {
            // Retry with backoff
            const delay = this.calculateBackoff(request.retryCount, retryAfterSeconds);
            
            setTimeout(() => {
              this.queue.push({
                ...request,
                retryCount: request.retryCount + 1
              });
              this.processQueue();
            }, delay);
            
            return;
          }
        }

        // For other errors or max retries reached, reject
        const error = new Error(`Request failed: ${response.status} ${response.statusText}`);
        (error as any).status = response.status;
        (error as any).response = await response.json().catch(() => ({}));
        request.reject(error);
        return;
      }

      // Success
      const data = await response.json();
      request.resolve(data);
    } catch (error: any) {
      // Network errors or timeouts
      if (request.retryCount < request.maxRetries && !error.name?.includes('AbortError')) {
        const delay = this.calculateBackoff(request.retryCount);
        
        setTimeout(() => {
          this.queue.push({
            ...request,
            retryCount: request.retryCount + 1
          });
          this.processQueue();
        }, delay);
      } else {
        request.reject(error);
      }
    }
  }

  // Add a request to the queue
  async enqueue<T>(
    endpoint: string,
    method: string,
    options: RequestInit,
    maxRetries: number = 3
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        endpoint,
        method,
        options,
        retryCount: 0,
        maxRetries,
        resolve,
        reject,
        timestamp: Date.now()
      });

      this.processQueue();
    });
  }

  // Get queue status
  getStatus() {
    return {
      queued: this.queue.length,
      active: this.activeRequests,
      processing: this.processing
    };
  }
}

export const requestQueue = new RequestQueue();
