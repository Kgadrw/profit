import { useEffect, useState } from "react";

export function SplashScreen() {
  const [isRemoved, setIsRemoved] = useState(false);

  useEffect(() => {
    // Wait for React to fully render before removing splash
    const removeSplash = () => {
      if (isRemoved) return;
      
      const htmlSplash = document.getElementById("splash-screen");
      const root = document.getElementById("root");
      
      // First, show the root content (fade in)
      if (root) {
        requestAnimationFrame(() => {
          root.classList.add('loaded');
        });
      }
      
      // Then remove splash screen smoothly
      if (htmlSplash) {
        // Use double requestAnimationFrame to ensure smooth transition
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            htmlSplash.style.transition = "opacity 0.2s ease-out";
            htmlSplash.style.opacity = "0";
            setTimeout(() => {
              if (htmlSplash.parentNode) {
                htmlSplash.remove();
                setIsRemoved(true);
                
                // Finally, allow body scrolling (this prevents bounce)
                requestAnimationFrame(() => {
                  document.body.classList.add('loaded');
                });
              }
            }, 200);
          });
        });
      } else {
        // If splash already removed, just mark everything as loaded
        if (root) {
          root.classList.add('loaded');
        }
        requestAnimationFrame(() => {
          document.body.classList.add('loaded');
        });
      }
    };

    // Wait for React to fully hydrate - slightly longer delay
    const timer = setTimeout(() => {
      removeSplash();
    }, 200);

    return () => {
      clearTimeout(timer);
    };
  }, [isRemoved]);

  // This component doesn't render anything, it just handles removal of HTML splash
  return null;
}
