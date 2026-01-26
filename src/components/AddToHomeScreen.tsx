import { useState, useEffect } from "react";
import { X, Download, Smartphone, Sparkles } from "lucide-react";
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
      <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-slide-up-fade">
        <div className="relative bg-gradient-to-br from-white via-blue-50/30 to-purple-50/20 backdrop-blur-xl rounded-2xl shadow-2xl p-6 border-0 overflow-hidden">
          {/* Decorative gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 pointer-events-none" />
          
          {/* Animated sparkle effect */}
          <div className="absolute top-3 right-3 opacity-20 animate-pulse">
            <Sparkles className="text-blue-500" size={24} />
          </div>

          <div className="relative flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl shadow-lg">
                <Download className="text-white" size={20} />
              </div>
              <h3 className="font-bold text-gray-900 text-lg">Install Trippo</h3>
            </div>
            <button
              onClick={handleDismiss}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100/80 rounded-full transition-all duration-200"
            >
              <X size={18} />
            </button>
          </div>
          
          <p className="text-sm text-gray-600 mb-5 leading-relaxed relative z-10">
            Install Trippo as an app on your computer. It will run in its own window, work offline, and launch faster.
          </p>
          
          <div className="flex gap-3 relative z-10">
            <Button
              onClick={handleInstallClick}
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 font-semibold"
              size="sm"
            >
              <Download size={16} className="mr-2" />
              Install App
            </Button>
            <Button
              onClick={handleDismiss}
              variant="ghost"
              className="flex-1 rounded-full hover:bg-gray-100/80 transition-all duration-200 font-medium"
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
      <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-slide-up-fade">
        <div className="relative bg-gradient-to-br from-white via-blue-50/30 to-purple-50/20 backdrop-blur-xl rounded-2xl shadow-2xl p-6 border-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 pointer-events-none" />
          
          <div className="absolute top-3 right-3 opacity-20 animate-pulse">
            <Sparkles className="text-blue-500" size={24} />
          </div>

          <div className="relative flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl shadow-lg">
                <Download className="text-white" size={20} />
              </div>
              <h3 className="font-bold text-gray-900 text-lg">Install Trippo</h3>
            </div>
            <button
              onClick={handleDismiss}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100/80 rounded-full transition-all duration-200"
            >
              <X size={18} />
            </button>
          </div>
          
          <p className="text-sm text-gray-600 mb-4 leading-relaxed relative z-10">
            Install Trippo as an app on Windows:
          </p>
          
          <ol className="text-sm text-gray-700 space-y-2.5 mb-5 list-decimal list-inside relative z-10 pl-2">
            <li className="leading-relaxed">Click the <strong className="text-gray-900">Install</strong> icon <span className="text-blue-600 font-bold">⊕</span> in the address bar, or</li>
            <li className="leading-relaxed">Click the <strong className="text-gray-900">Menu</strong> button <span className="text-blue-600 font-bold">⋮</span> (three dots) → <strong className="text-gray-900">"Install Trippo"</strong></li>
            <li className="leading-relaxed">The app will open in its own window</li>
          </ol>
          
          <Button
            onClick={handleDismiss}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 font-semibold relative z-10"
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
      <div className="fixed bottom-20 left-4 right-4 z-50 animate-slide-up-fade">
        <div className="relative bg-gradient-to-br from-white via-blue-50/30 to-purple-50/20 backdrop-blur-xl rounded-2xl shadow-2xl p-6 max-w-md mx-auto border-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 pointer-events-none" />
          
          <div className="absolute top-3 right-3 opacity-20 animate-pulse">
            <Sparkles className="text-blue-500" size={24} />
          </div>

          <div className="relative flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl shadow-lg">
                <Smartphone className="text-white" size={20} />
              </div>
              <h3 className="font-bold text-gray-900 text-lg">Add to Home Screen</h3>
            </div>
            <button
              onClick={handleDismiss}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100/80 rounded-full transition-all duration-200"
            >
              <X size={18} />
            </button>
          </div>
          
          <p className="text-sm text-gray-600 mb-4 leading-relaxed relative z-10">
            Install Trippo on your iPhone for quick access:
          </p>
          
          <ol className="text-sm text-gray-700 space-y-2.5 mb-5 list-decimal list-inside relative z-10 pl-2">
            <li className="leading-relaxed">Tap the <strong className="text-gray-900">Share</strong> button <span className="text-blue-600 font-bold">□↑</span> at the bottom</li>
            <li className="leading-relaxed">Scroll down and tap <strong className="text-gray-900">"Add to Home Screen"</strong></li>
            <li className="leading-relaxed">Tap <strong className="text-gray-900">"Add"</strong> to confirm</li>
          </ol>
          
          <Button
            onClick={handleDismiss}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 font-semibold relative z-10"
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
      <div className="fixed bottom-20 left-4 right-4 z-50 animate-slide-up-fade">
        <div className="relative bg-gradient-to-br from-white via-blue-50/30 to-purple-50/20 backdrop-blur-xl rounded-2xl shadow-2xl p-6 max-w-md mx-auto border-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 pointer-events-none" />
          
          <div className="absolute top-3 right-3 opacity-20 animate-pulse">
            <Sparkles className="text-blue-500" size={24} />
          </div>

          <div className="relative flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl shadow-lg">
                <Download className="text-white" size={20} />
              </div>
              <h3 className="font-bold text-gray-900 text-lg">Install Trippo</h3>
            </div>
            <button
              onClick={handleDismiss}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100/80 rounded-full transition-all duration-200"
            >
              <X size={18} />
            </button>
          </div>
          
          <p className="text-sm text-gray-600 mb-5 leading-relaxed relative z-10">
            Add Trippo to your home screen for quick access and offline use.
          </p>
          
          <div className="flex gap-3 relative z-10">
            <Button
              onClick={handleInstallClick}
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 font-semibold"
              size="sm"
            >
              <Download size={16} className="mr-2" />
              Install
            </Button>
            <Button
              onClick={handleDismiss}
              variant="ghost"
              className="flex-1 rounded-full hover:bg-gray-100/80 transition-all duration-200 font-medium"
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
      <div className="fixed bottom-20 left-4 right-4 z-50 animate-slide-up-fade">
        <div className="relative bg-gradient-to-br from-white via-blue-50/30 to-purple-50/20 backdrop-blur-xl rounded-2xl shadow-2xl p-6 max-w-md mx-auto border-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 pointer-events-none" />
          
          <div className="absolute top-3 right-3 opacity-20 animate-pulse">
            <Sparkles className="text-blue-500" size={24} />
          </div>

          <div className="relative flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl shadow-lg">
                <Smartphone className="text-white" size={20} />
              </div>
              <h3 className="font-bold text-gray-900 text-lg">Add to Home Screen</h3>
            </div>
            <button
              onClick={handleDismiss}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100/80 rounded-full transition-all duration-200"
            >
              <X size={18} />
            </button>
          </div>
          
          <p className="text-sm text-gray-600 mb-4 leading-relaxed relative z-10">
            Install Trippo on your Android device:
          </p>
          
          <ol className="text-sm text-gray-700 space-y-2.5 mb-5 list-decimal list-inside relative z-10 pl-2">
            <li className="leading-relaxed">Tap the <strong className="text-gray-900">Menu</strong> button <span className="text-blue-600 font-bold">⋮</span> (three dots)</li>
            <li className="leading-relaxed">Select <strong className="text-gray-900">"Add to Home screen"</strong> or <strong className="text-gray-900">"Install app"</strong></li>
            <li className="leading-relaxed">Tap <strong className="text-gray-900">"Add"</strong> or <strong className="text-gray-900">"Install"</strong> to confirm</li>
          </ol>
          
          <Button
            onClick={handleDismiss}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 font-semibold relative z-10"
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
