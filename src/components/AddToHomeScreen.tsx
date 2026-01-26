import { useState, useEffect } from "react";
import { X, Download, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function AddToHomeScreen() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isWindows, setIsWindows] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Detect Android
    const android = /Android/.test(navigator.userAgent);
    setIsAndroid(android);

    // Detect Windows
    const windows = /Windows/.test(navigator.userAgent);
    setIsWindows(windows);

    // Listen for the beforeinstallprompt event (Android Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show prompt after a delay (e.g., 3 seconds after page load)
      setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
    };

    // For iOS, show instructions after a delay
    if (iOS) {
      setTimeout(() => {
        setShowPrompt(true);
      }, 5000);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Check if app was just installed
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setShowPrompt(false);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // Show the install prompt
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === "accepted") {
        setShowPrompt(false);
        setIsInstalled(true);
      }
      
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Don't show again for this session
    sessionStorage.setItem("add-to-home-dismissed", "true");
  };

  // Don't show if already installed or dismissed
  if (isInstalled || !showPrompt || sessionStorage.getItem("add-to-home-dismissed") === "true") {
    return null;
  }

  // Windows/Desktop prompt (Chrome/Edge)
  if ((isWindows || (!isIOS && !isAndroid)) && deferredPrompt) {
    return (
      <div className="fixed bottom-4 right-4 z-50 animate-fade-in max-w-sm">
        <div className="bg-white border-2 border-blue-600 rounded-lg shadow-xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <Download className="text-blue-600" size={20} />
              <h3 className="font-semibold text-gray-900">Install Trippo</h3>
            </div>
            <button
              onClick={handleDismiss}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            Install Trippo as an app on your computer. It will run in its own window, work offline, and launch faster.
          </p>
          <div className="flex gap-2">
            <Button
              onClick={handleInstallClick}
              className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
              size="sm"
            >
              <Download size={16} className="mr-2" />
              Install App
            </Button>
            <Button
              onClick={handleDismiss}
              variant="outline"
              className="flex-1"
              size="sm"
            >
              Not now
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Windows/Desktop manual instructions (if prompt not available)
  if ((isWindows || (!isIOS && !isAndroid)) && !deferredPrompt) {
    return (
      <div className="fixed bottom-4 right-4 z-50 animate-fade-in max-w-sm">
        <div className="bg-white border-2 border-blue-600 rounded-lg shadow-xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <Download className="text-blue-600" size={20} />
              <h3 className="font-semibold text-gray-900">Install Trippo</h3>
            </div>
            <button
              onClick={handleDismiss}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            Install Trippo as an app on Windows:
          </p>
          <ol className="text-xs text-gray-700 space-y-2 mb-3 list-decimal list-inside">
            <li>Click the <strong>Install</strong> icon <span className="text-blue-600">⊕</span> in the address bar, or</li>
            <li>Click the <strong>Menu</strong> button <span className="text-blue-600">⋮</span> (three dots) → <strong>"Install Trippo"</strong></li>
            <li>The app will open in its own window</li>
          </ol>
          <Button
            onClick={handleDismiss}
            className="w-full bg-blue-600 text-white hover:bg-blue-700"
            size="sm"
          >
            Got it!
          </Button>
        </div>
      </div>
    );
  }

  // iOS instructions
  if (isIOS) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-50 animate-fade-in">
        <div className="bg-white border-2 border-blue-600 rounded-lg shadow-lg p-4 max-w-md mx-auto">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <Smartphone className="text-blue-600" size={20} />
              <h3 className="font-semibold text-gray-900">Add to Home Screen</h3>
            </div>
            <button
              onClick={handleDismiss}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            Install Trippo on your iPhone for quick access:
          </p>
          <ol className="text-xs text-gray-700 space-y-2 mb-3 list-decimal list-inside">
            <li>Tap the <strong>Share</strong> button <span className="text-blue-600">□↑</span> at the bottom</li>
            <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
            <li>Tap <strong>"Add"</strong> to confirm</li>
          </ol>
          <Button
            onClick={handleDismiss}
            className="w-full bg-blue-600 text-white hover:bg-blue-700"
            size="sm"
          >
            Got it!
          </Button>
        </div>
      </div>
    );
  }

  // Android prompt
  if (isAndroid && deferredPrompt) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-50 animate-fade-in">
        <div className="bg-white border-2 border-blue-600 rounded-lg shadow-lg p-4 max-w-md mx-auto">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <Download className="text-blue-600" size={20} />
              <h3 className="font-semibold text-gray-900">Install Trippo</h3>
            </div>
            <button
              onClick={handleDismiss}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            Add Trippo to your home screen for quick access and offline use.
          </p>
          <div className="flex gap-2">
            <Button
              onClick={handleInstallClick}
              className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
              size="sm"
            >
              <Download size={16} className="mr-2" />
              Install
            </Button>
            <Button
              onClick={handleDismiss}
              variant="outline"
              className="flex-1"
              size="sm"
            >
              Not now
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Android manual instructions (if prompt not available)
  if (isAndroid && !deferredPrompt) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-50 animate-fade-in">
        <div className="bg-white border-2 border-blue-600 rounded-lg shadow-lg p-4 max-w-md mx-auto">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <Smartphone className="text-blue-600" size={20} />
              <h3 className="font-semibold text-gray-900">Add to Home Screen</h3>
            </div>
            <button
              onClick={handleDismiss}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            Install Trippo on your Android device:
          </p>
          <ol className="text-xs text-gray-700 space-y-2 mb-3 list-decimal list-inside">
            <li>Tap the <strong>Menu</strong> button <span className="text-blue-600">⋮</span> (three dots)</li>
            <li>Select <strong>"Add to Home screen"</strong> or <strong>"Install app"</strong></li>
            <li>Tap <strong>"Add"</strong> or <strong>"Install"</strong> to confirm</li>
          </ol>
          <Button
            onClick={handleDismiss}
            className="w-full bg-blue-600 text-white hover:bg-blue-700"
            size="sm"
          >
            Got it!
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
