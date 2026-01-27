import { useState, useEffect } from "react";
import { AdminSidebar } from "./AdminSidebar";
import { AdminBottomNav } from "./AdminBottomNav";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export function AdminLayout({ children, title, activeSection, onSectionChange }: AdminLayoutProps) {
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
  const [currentBgIndex, setCurrentBgIndex] = useState(() => {
    // Load saved index and timestamp from localStorage
    const savedIndex = localStorage.getItem('profit-pilot-bg-index');
    const savedTimestamp = localStorage.getItem('profit-pilot-bg-timestamp');
    
    if (savedIndex && savedTimestamp) {
      const lastChange = parseInt(savedTimestamp, 10);
      const now = Date.now();
      const oneDayInMs = 24 * 60 * 60 * 1000; // 1 day in milliseconds
      
      // If less than 1 day has passed, use saved index
      if (now - lastChange < oneDayInMs) {
        return parseInt(savedIndex, 10);
      }
      // If 1 day has passed, rotate to next image
      const nextIndex = (parseInt(savedIndex, 10) + 1) % backgroundImages.length;
      localStorage.setItem('profit-pilot-bg-index', nextIndex.toString());
      localStorage.setItem('profit-pilot-bg-timestamp', now.toString());
      return nextIndex;
    }
    
    // First time - start with index 0
    const now = Date.now();
    localStorage.setItem('profit-pilot-bg-index', '0');
    localStorage.setItem('profit-pilot-bg-timestamp', now.toString());
    return 0;
  });
  
  // Check daily rotation
  useEffect(() => {
    if (!isMobile) return;
    
    const checkAndRotate = () => {
      const savedIndex = localStorage.getItem('profit-pilot-bg-index');
      const savedTimestamp = localStorage.getItem('profit-pilot-bg-timestamp');
      
      if (savedIndex && savedTimestamp) {
        const lastChange = parseInt(savedTimestamp, 10);
        const now = Date.now();
        const oneDayInMs = 24 * 60 * 60 * 1000; // 1 day in milliseconds
        
        // If 1 day has passed, rotate to next image
        if (now - lastChange >= oneDayInMs) {
          const nextIndex = (parseInt(savedIndex, 10) + 1) % backgroundImages.length;
          setCurrentBgIndex(nextIndex);
          localStorage.setItem('profit-pilot-bg-index', nextIndex.toString());
          localStorage.setItem('profit-pilot-bg-timestamp', now.toString());
        }
      }
    };
    
    // Check immediately
    checkAndRotate();
    
    // Check every hour to see if a day has passed
    const intervalId = setInterval(checkAndRotate, 60 * 60 * 1000); // Check every hour
    
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
      className="min-h-screen bg-background lg:bg-background"
      style={{
        backgroundImage: isMobile ? `url('${backgroundImages[currentBgIndex]}')` : undefined,
        backgroundSize: isMobile ? "cover" : undefined,
        backgroundPosition: isMobile ? "center" : undefined,
        backgroundRepeat: isMobile ? "no-repeat" : undefined,
        backgroundAttachment: isMobile ? "fixed" : undefined,
      }}
    >
      {/* Sidebar - Hidden on mobile, visible on desktop */}
      <div className="hidden lg:block">
        <AdminSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          onMobileClose={() => {}}
          onMobileToggle={() => {}}
          onHoverChange={setSidebarHovered}
          activeSection={activeSection}
          onSectionChange={onSectionChange}
          mobileExpanded={false}
        />
      </div>

      {/* Bottom Navigation - Only visible on mobile */}
      <div className="lg:hidden">
        <AdminBottomNav
          activeSection={activeSection}
          onSectionChange={onSectionChange}
        />
      </div>

      {/* Main content */}
      <div
        className={cn(
          "transition-all duration-300",
          // On mobile, no margin (bottom nav instead of sidebar)
          // On desktop, adjust based on sidebar state
          isMobile 
            ? "ml-0 pb-16" // Add bottom padding for bottom nav
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
