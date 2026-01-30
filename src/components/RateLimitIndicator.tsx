// Rate Limit Indicator Component
// Shows user-friendly message when rate limited

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

interface RateLimitIndicatorProps {
  retryAfter?: number;
  onRetry?: () => void;
  message?: string;
}

export function RateLimitIndicator({ 
  retryAfter, 
  onRetry,
  message = "High traffic right now. Please wait a moment..."
}: RateLimitIndicatorProps) {
  const [countdown, setCountdown] = useState(retryAfter || 0);
  const [showRetry, setShowRetry] = useState(false);

  useEffect(() => {
    if (retryAfter && retryAfter > 0) {
      setCountdown(retryAfter);
      setShowRetry(false);
      
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            setShowRetry(true);
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    } else {
      setShowRetry(true);
    }
  }, [retryAfter]);

  return (
    <Alert variant="default" className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
      <AlertCircle className="h-4 w-4 text-yellow-600" />
      <AlertTitle className="text-yellow-800 dark:text-yellow-200">
        High Traffic Detected
      </AlertTitle>
      <AlertDescription className="text-yellow-700 dark:text-yellow-300">
        <p className="mb-2">{message}</p>
        {countdown > 0 && (
          <p className="text-sm">
            Retrying in {countdown} second{countdown !== 1 ? 's' : ''}...
          </p>
        )}
        {showRetry && onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="mt-2 border-yellow-600 text-yellow-700 hover:bg-yellow-100"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry Now
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
