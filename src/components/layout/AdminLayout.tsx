import { useState, useEffect } from "react";
import { AdminSidebar } from "./AdminSidebar";
import { cn } from "@/lib/utils";

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export function AdminLayout({ children, title, activeSection, onSectionChange }: AdminLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);

  // Handle responsive sidebar
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarCollapsed(true);
        setMobileMenuOpen(false);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleMenuToggle = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "lg:block",
        mobileMenuOpen ? "block" : "hidden"
      )}>
        <AdminSidebar
          collapsed={sidebarCollapsed && !mobileMenuOpen}
          onToggle={() => {
            if (window.innerWidth < 1024) {
              setMobileMenuOpen(false);
            } else {
              setSidebarCollapsed(!sidebarCollapsed);
            }
          }}
          onMobileClose={() => setMobileMenuOpen(false)}
          onMobileToggle={handleMenuToggle}
          onHoverChange={setSidebarHovered}
          activeSection={activeSection}
          onSectionChange={onSectionChange}
        />
      </div>

      {/* Main content */}
      <div
        className={cn(
          "transition-all duration-300",
          // If sidebar is hovered and collapsed, expand it (push content)
          // Otherwise use the normal collapsed/expanded state
          (sidebarHovered && sidebarCollapsed) || !sidebarCollapsed ? "lg:ml-56" : "lg:ml-16"
        )}
      >
        <main className="p-6 animate-fade-in">{children}</main>
      </div>
    </div>
  );
}
