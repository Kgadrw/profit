import { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { MobileHeader } from "./MobileHeader";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

interface AppLayoutProps {
  children: React.ReactNode;
  title: string;
}

export function AppLayout({ children, title }: AppLayoutProps) {
  // Load sidebar collapsed state from localStorage
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem("profit-pilot-sidebar-collapsed");
    return saved === "true";
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const [showArrow, setShowArrow] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileSidebarExpanded, setMobileSidebarExpanded] = useState(false);
  
  // Rotating background images for mobile (1.jpg through 5.jpg)
  const backgroundImages = ['/1.jpg', '/2.jpg', '/3.jpg', '/4.jpg', '/5.jpg'];
  
  // Helper function to get today's date string (YYYY-MM-DD)
  const getTodayDateString = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  };
  
  const [currentBgIndex, setCurrentBgIndex] = useState(() => {
    // Load saved index and date from localStorage
    const savedIndex = localStorage.getItem('profit-pilot-bg-index');
    const savedDate = localStorage.getItem('profit-pilot-bg-date');
    const todayDate = getTodayDateString();
    
    if (savedIndex && savedDate) {
      // If it's the same day, use saved index
      if (savedDate === todayDate) {
        return parseInt(savedIndex, 10);
      }
      // If it's a different day, immediately rotate to next image (no animation on initial load)
      const nextIndex = (parseInt(savedIndex, 10) + 1) % backgroundImages.length;
      localStorage.setItem('profit-pilot-bg-index', nextIndex.toString());
      localStorage.setItem('profit-pilot-bg-date', todayDate);
      // Mark that we've already changed for today, so future changes in the same session will animate
      localStorage.setItem('profit-pilot-bg-changed-today', 'true');
      return nextIndex;
    }
    
    // First time - start with index 0
    localStorage.setItem('profit-pilot-bg-index', '0');
    localStorage.setItem('profit-pilot-bg-date', todayDate);
    localStorage.setItem('profit-pilot-bg-changed-today', 'false');
    return 0;
  });
  
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Function to manually change today's background image
  const changeTodaysBgImage = (imageIndex?: number) => {
    if (!isMobile) return;
    const nextIndex = imageIndex !== undefined 
      ? Math.max(0, Math.min(imageIndex, backgroundImages.length - 1))
      : (currentBgIndex + 1) % backgroundImages.length;
    setIsAnimating(true);
    
    setTimeout(() => {
      setCurrentBgIndex(nextIndex);
      localStorage.setItem('profit-pilot-bg-index', nextIndex.toString());
      localStorage.setItem('profit-pilot-bg-date', getTodayDateString());
      localStorage.setItem('profit-pilot-bg-changed-today', 'true');
      
      setTimeout(() => {
        setIsAnimating(false);
      }, 50);
    }, 500);
  };
  
  // Expose function to window for manual control
  // Usage: window.changeTodaysBgImage() - changes to next image
  //        window.changeTodaysBgImage(0) - changes to image 1.jpg (index 0)
  //        window.changeTodaysBgImage(4) - changes to image 5.jpg (index 4)
  useEffect(() => {
    (window as any).changeTodaysBgImage = changeTodaysBgImage;
    return () => {
      delete (window as any).changeTodaysBgImage;
    };
  }, [currentBgIndex, isMobile]);
  
  // Check daily rotation - changes when calendar day changes (at midnight)
  useEffect(() => {
    if (!isMobile) return;
    
    const checkAndRotate = () => {
      const savedIndex = localStorage.getItem('profit-pilot-bg-index');
      const savedDate = localStorage.getItem('profit-pilot-bg-date');
      const changedToday = localStorage.getItem('profit-pilot-bg-changed-today');
      const todayDate = getTodayDateString();
      
      if (savedIndex && savedDate && savedDate !== todayDate) {
        // Day has changed! Rotate to next image
        const nextIndex = (parseInt(savedIndex, 10) + 1) % backgroundImages.length;
        
        // If we haven't changed today yet (initial load), change immediately without animation
        if (changedToday !== 'true') {
          setCurrentBgIndex(nextIndex);
          localStorage.setItem('profit-pilot-bg-index', nextIndex.toString());
          localStorage.setItem('profit-pilot-bg-date', todayDate);
          localStorage.setItem('profit-pilot-bg-changed-today', 'true');
        } else {
          // If day changes during the session (midnight), animate the change
          setIsAnimating(true);
          
          // Change image after fade out
          setTimeout(() => {
            setCurrentBgIndex(nextIndex);
            localStorage.setItem('profit-pilot-bg-index', nextIndex.toString());
            localStorage.setItem('profit-pilot-bg-date', todayDate);
            
            // Fade in
            setTimeout(() => {
              setIsAnimating(false);
            }, 50);
          }, 500); // Half of animation duration
        }
      } else if (savedDate === todayDate && changedToday === 'true') {
        // Same day, reset the flag for next day
        // This ensures animation works when day changes during session
        localStorage.setItem('profit-pilot-bg-changed-today', 'false');
      }
    };
    
    // Check immediately
    checkAndRotate();
    
    // Check every minute to catch midnight changes quickly
    const intervalId = setInterval(checkAndRotate, 60 * 1000); // Check every minute
    
    return () => clearInterval(intervalId);
  }, [isMobile, backgroundImages.length]);

  // Save sidebar collapsed state to localStorage whenever it changes (only on desktop)
  useEffect(() => {
    if (!isMobile) {
      localStorage.setItem("profit-pilot-sidebar-collapsed", String(sidebarCollapsed));
    }
  }, [sidebarCollapsed, isMobile]);

  // Minimum swipe distance
  const minSwipeDistance = 50;

  // Handle responsive sidebar - always collapsed on mobile
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) {
        // Only force collapse on mobile, don't save to localStorage
        setSidebarCollapsed(true);
        setMobileMenuOpen(false);
      } else {
        // On desktop, restore saved state
        const saved = localStorage.getItem("profit-pilot-sidebar-collapsed");
        if (saved !== null) {
          setSidebarCollapsed(saved === "true");
        }
      }
    };

    // Set initial state
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Handle scroll detection to hide arrow
  useEffect(() => {
    let scrollTimeout: NodeJS.Timeout;
    let lastScrollTop = 0;

    const handleScroll = () => {
      if (window.innerWidth >= 1024) return; // Only on mobile

      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      
      // Hide arrow when scrolling
      setIsScrolling(true);
      setShowArrow(false);

      // Show arrow after scrolling stops
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        setIsScrolling(false);
        setShowArrow(true);
      }, 1000);

      lastScrollTop = scrollTop;
    };

    // Only add scroll listener on mobile
    if (window.innerWidth < 1024) {
      window.addEventListener("scroll", handleScroll, { passive: true });
    }

    return () => {
      window.removeEventListener("scroll", handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, []);

  const handleMenuToggle = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  // Handle touch start for swipe detection
  const onTouchStart = (e: React.TouchEvent) => {
    // Only handle on mobile
    if (window.innerWidth >= 1024) return;
    
    setTouchEnd(null);
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
  };

  // Handle touch move for swipe detection
  const onTouchMove = (e: React.TouchEvent) => {
    // Only handle on mobile
    if (window.innerWidth >= 1024) return;
    
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
  };

  // Handle touch end and detect swipe
  const onTouchEnd = () => {
    // Only handle on mobile
    if (window.innerWidth >= 1024) return;
    
    if (!touchStart || !touchEnd) return;

    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    const isLeftSwipe = distanceX > minSwipeDistance;
    const isRightSwipe = distanceX < -minSwipeDistance;
    const isVerticalSwipe = Math.abs(distanceY) > Math.abs(distanceX);

    // Only handle horizontal swipes
    if (isVerticalSwipe) return;

    // Swipe from left edge (within 30px) to right to open
    if (isRightSwipe && touchStart.x < 30 && !mobileMenuOpen) {
      setMobileMenuOpen(true);
    }
  };

  return (
    <div 
      className="min-h-screen bg-background lg:bg-background relative"
    >
      {/* Fixed background image - always stays in place */}
      {isMobile && (
        <>
          <div 
            className="fixed inset-0 z-0 pointer-events-none transition-opacity duration-1000 ease-in-out"
            style={{
              backgroundImage: `url('${backgroundImages[currentBgIndex]}')`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              willChange: "transform",
              opacity: isAnimating ? 0 : 1,
            }}
          />
          {/* Gradient overlay for background image */}
          <div 
            className="fixed inset-0 z-0 pointer-events-none transition-opacity duration-1000 ease-in-out"
            style={{
              background: "linear-gradient(to bottom, rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.6))",
              opacity: isAnimating ? 0 : 1,
            }}
          />
        </>
      )}
      {/* Mobile Header - Only visible on mobile */}
      <div className="lg:hidden">
        <MobileHeader />
      </div>

      {/* Sidebar - Hidden on mobile, visible on desktop */}
      <div className="hidden lg:block">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          onMobileClose={() => {}}
          onMobileToggle={() => {}}
          onHoverChange={setSidebarHovered}
          mobileExpanded={false}
        />
      </div>

      {/* Bottom Navigation - Only visible on mobile */}
      <div className="lg:hidden">
        <BottomNav />
      </div>

      {/* Main content */}
      <div
        className={cn(
          "transition-all duration-300 relative z-10",
          // On mobile, no margin (bottom nav instead of sidebar), add top padding for header
          // On desktop, adjust based on sidebar state
          isMobile 
            ? "ml-0 pb-16 pt-20" // Add bottom padding for bottom nav and top padding for mobile header
            : "lg:ml-0",
          !isMobile && ((sidebarHovered && sidebarCollapsed) || !sidebarCollapsed 
            ? "lg:ml-56" 
            : "lg:ml-16")
        )}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ touchAction: 'pan-y' }}
      >
        <main className="p-6 animate-fade-in lg:pt-6 pt-6">{children}</main>
      </div>
    </div>
  );
}
