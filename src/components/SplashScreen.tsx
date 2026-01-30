import { useEffect, useState } from "react";

export function SplashScreen() {
  const [isRemoved, setIsRemoved] = useState(false);

  useEffect(() => {
    // Ensure body is visible (in case it was hidden by initial script)
    document.body.classList.add('loaded');
    
    // Remove the HTML splash screen when React app is ready
    const removeSplash = () => {
      if (isRemoved) return;
      
      const htmlSplash = document.getElementById("splash-screen");
      if (htmlSplash) {
        // Use requestAnimationFrame to ensure smooth transition
        requestAnimationFrame(() => {
          htmlSplash.style.transition = "opacity 0.3s ease-out";
          htmlSplash.style.opacity = "0";
          setTimeout(() => {
            if (htmlSplash.parentNode) {
              htmlSplash.remove();
              setIsRemoved(true);
            }
          }, 300);
        });
      }
    };

    // Wait for React to fully hydrate before removing splash
    // Use a small delay to ensure all components are rendered
    const timer = setTimeout(() => {
      removeSplash();
    }, 100);

    // Also remove when window is fully loaded (fallback)
    const handleLoad = () => {
      clearTimeout(timer);
      removeSplash();
    };

    if (document.readyState === "complete") {
      clearTimeout(timer);
      removeSplash();
    } else {
      window.addEventListener("load", handleLoad, { once: true });
    }

    return () => {
      clearTimeout(timer);
      window.removeEventListener("load", handleLoad);
    };
  }, [isRemoved]);

  // This component doesn't render anything, it just handles removal of HTML splash
  return null;
}
