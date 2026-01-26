import { useEffect } from "react";

export function SplashScreen() {
  useEffect(() => {
    // Remove the HTML splash screen when React app is ready
    const removeSplash = () => {
      const htmlSplash = document.getElementById("splash-screen");
      if (htmlSplash) {
        htmlSplash.style.transition = "opacity 0.5s ease-out";
        htmlSplash.style.opacity = "0";
        setTimeout(() => {
          htmlSplash.remove();
        }, 500);
      }
    };

    // Wait a bit to ensure smooth transition
    const timer = setTimeout(() => {
      removeSplash();
    }, 800);

    // Also remove when window is fully loaded
    if (document.readyState === "complete") {
      clearTimeout(timer);
      removeSplash();
    } else {
      window.addEventListener("load", () => {
        clearTimeout(timer);
        removeSplash();
      }, { once: true });
    }

    return () => {
      clearTimeout(timer);
    };
  }, []);

  // This component doesn't render anything, it just handles removal of HTML splash
  return null;
}
