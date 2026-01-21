import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { LoginModal } from "@/components/LoginModal";
import { User, Globe, Instagram, Phone } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useLanguage } from "@/hooks/useLanguage";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const Home = () => {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginModalTab, setLoginModalTab] = useState<"login" | "create">("create");

  // Reset login modal state when user logs out (listen for auth changes)
  useEffect(() => {
    const handleAuthChange = () => {
      const userId = localStorage.getItem("profit-pilot-user-id");
      const authenticated = sessionStorage.getItem("profit-pilot-authenticated") === "true";
      
      // If user is logged out, ensure modal can be opened
      if (!userId || !authenticated) {
        setLoginModalOpen(false);
        setLoginModalTab("login");
      }
    };

    // Prevent back button navigation to protected routes
    const handlePopState = () => {
      const userId = localStorage.getItem("profit-pilot-user-id");
      const authenticated = sessionStorage.getItem("profit-pilot-authenticated") === "true";
      const currentPath = window.location.pathname;
      const protectedRoutes = ['/dashboard', '/products', '/sales', '/reports', '/settings', '/admin-dashboard'];
      const isProtectedRoute = protectedRoutes.some(route => currentPath.startsWith(route));

      if (isProtectedRoute && (!userId || !authenticated)) {
        // User tried to access protected route via back button without auth
        window.history.replaceState(null, "", "/");
        window.location.href = "/";
      }
    };

    window.addEventListener("pin-auth-changed", handleAuthChange);
    window.addEventListener("storage", handleAuthChange);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("pin-auth-changed", handleAuthChange);
      window.removeEventListener("storage", handleAuthChange);
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      
      {/* Hero Section */}
      <main className="relative min-h-[calc(100vh-4rem)] flex items-center px-6 lg:px-12 xl:px-20 py-16 lg:py-24">
        <div className="w-full max-w-7xl mx-auto flex flex-col gap-12">
          {/* Text Content */}
          <header className="text-left max-w-2xl">
            <h1 className="text-2xl lg:text-3xl font-serif font-normal text-gray-900 mb-8 leading-tight">
              {t("runBusinessSmarter")}
            </h1>
            <Button
              className="bg-gray-400 text-white hover:bg-gray-600 px-5 py-2.5 text-sm font-medium rounded-full"
              onClick={() => {
                setLoginModalTab("create");
                setLoginModalOpen(true);
              }}
            >
              {t("getStarted")}
            </Button>
          </header>
          
          {/* Hero Images */}
          <div className="w-full flex gap-0">
            {/* Card 1 */}
            <div className="w-1/5 relative group h-32 md:h-80">
              <img 
                src="/card1.jpg" 
                alt="Woman managing inventory with Trippo" 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/20"></div>
            </div>

            {/* Card 2 */}
            <div className="w-1/5 relative group h-32 md:h-80">
              <img 
                src="/card2.png" 
                alt="Man struggling with business" 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/20"></div>
            </div>

            {/* Card 3 */}
            <div className="w-1/5 relative group h-32 md:h-80">
              <img 
                src="/card3.jpg" 
                alt="Woman using Trippo system" 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/20"></div>
            </div>

            {/* Card 4 */}
            <div className="w-1/5 relative group h-32 md:h-80">
              <img 
                src="/card4.jpg" 
                alt="Happy team managing stock" 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/20"></div>
            </div>

            {/* Card 5 */}
            <div className="w-1/5 relative group h-32 md:h-80">
              <img 
                src="/card5.jpg" 
                alt="Successful business owners" 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/20"></div>
            </div>
          </div>

                 {/* Feature Cards */}
                 <section className="w-full" aria-label="Features">
                   <h2 className="text-2xl lg:text-3xl font-serif font-normal text-gray-900 mb-6">{t("features")}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Product Management Card */}
              <div className="border border-gray-200 bg-gray-100 p-4">
                <div className="flex items-start gap-3 mb-3">
                  <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                    {t("productManagement")}
                  </span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {t("addEditManageInventory")}
                </p>
              </div>

              {/* Sales Tracking Card */}
              <div className="border border-gray-200 bg-gray-100 p-4">
                <div className="flex items-start gap-3 mb-3">
                  <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                    {t("salesTracking")}
                  </span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {t("recordSalesTransactions")}
                </p>
              </div>

              {/* Reports & Analytics Card */}
              <div className="border border-gray-200 bg-gray-100 p-4">
                <div className="flex items-start gap-3 mb-3">
                  <span className="px-2.5 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                    {t("reportsAnalytics")}
                  </span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {t("viewDetailedReports")}
                </p>
              </div>

              {/* Offline Support Card */}
              <div className="border border-gray-200 bg-gray-100 p-4">
                <div className="flex items-start gap-3 mb-3">
                  <span className="px-2.5 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                    {t("offlineSupport")}
                  </span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {t("workOfflineAutoSync")}
                </p>
              </div>
            </div>
          </section>

          {/* Testimonials */}
          <section className="w-full relative bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url(/testmonial.webp)' }} aria-label="Testimonials">
            <div className="absolute inset-0 bg-white/70"></div>
            <div className="relative z-10 py-12 px-6">
              <div className="text-center mb-6">
                       <h2 className="text-base lg:text-lg font-serif font-normal text-white inline-block px-4 py-1.5 bg-gray-600 rounded-full">
                         {t("whatOurUsersSay")}
                       </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Testimonial 1 */}
              <div className="bg-gray-50 p-6">
                <p className="text-sm text-gray-700 leading-relaxed mb-4">
                  "{t("trippoTransformedInventory")}"
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-300 rounded-full flex-shrink-0 flex items-center justify-center">
                    <User size={20} className="text-gray-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Sarah Johnson</p>
                    <p className="text-xs text-gray-500">{t("storeManagerRetailCo")}</p>
                  </div>
                </div>
              </div>

              {/* Testimonial 2 */}
              <div className="bg-gray-50 p-6">
                <p className="text-sm text-gray-700 leading-relaxed mb-4">
                  "{t("mostUsefulInventoryTool")}"
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-300 rounded-full flex-shrink-0 flex items-center justify-center">
                    <User size={20} className="text-gray-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Michael Chen</p>
                    <p className="text-xs text-gray-500">{t("businessOwnerChenTrading")}</p>
                  </div>
                </div>
      </div>

              {/* Testimonial 3 */}
              <div className="bg-gray-50 p-6">
                <p className="text-sm text-gray-700 leading-relaxed mb-4">
                  "{t("bestInventoryManagementFlexibility")}"
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-300 rounded-full flex-shrink-0 flex items-center justify-center">
                    <User size={20} className="text-gray-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">David Williams</p>
                    <p className="text-xs text-gray-500">{t("operationsDirectorWilliamsSupply")}</p>
                  </div>
                </div>
              </div>
              </div>
            </div>
          </section>

          {/* Pricing Cards */}
          <section className="w-full" aria-label="Pricing">
                   <h2 className="text-2xl lg:text-3xl font-serif font-normal text-gray-900 mb-6 text-center">{t("pricing")}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Basic Plan */}
              <div className="border border-gray-200 bg-gray-100 p-4 flex flex-col">
                <div className="flex items-start gap-3 mb-3">
                  <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                    {t("basicPlan")}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mb-3">
                  <span className="font-semibold text-lg">$0</span>
                  <span className="text-xs text-gray-500 ml-1">{t("perMonth")}</span>
                </p>
                <ul className="text-sm text-gray-700 space-y-2 leading-relaxed mb-4 flex-grow">
                  <li>• {t("productInventoryManagement")}</li>
                  <li>• {t("salesTrackingRecording")}</li>
                  <li>• {t("basicReportsAnalytics")}</li>
                  <li>• {t("offlineSupportSync")}</li>
                  <li>• {t("upTo100Products")}</li>
                </ul>
                <Button
                  className="bg-gray-500 text-white hover:bg-gray-600 rounded-full px-4 py-2 text-sm w-full"
                  onClick={() => {
                    setLoginModalTab("create");
                    setLoginModalOpen(true);
                  }}
                >
                  {t("getStarted")}
                </Button>
              </div>

              {/* Pro Plan - Empty */}
              <div className="border border-gray-200 bg-gray-100 p-4 flex flex-col opacity-30">
              </div>

              {/* Enterprise Plan - Empty */}
              <div className="border border-gray-200 bg-gray-100 p-4 flex flex-col opacity-30">
              </div>

              {/* Custom Plan - Empty */}
              <div className="border border-gray-200 bg-gray-100 p-4 flex flex-col opacity-30">
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Login Modal */}
      <LoginModal
        open={loginModalOpen}
        onOpenChange={setLoginModalOpen}
        defaultTab={loginModalTab}
      />
      
      {/* Footer */}
      <footer className="bg-stone-50 border-t border-gray-200" role="contentinfo">
        <div className="container mx-auto px-6 lg:px-12 xl:px-20 py-12">
          {/* Bottom Section */}
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-gray-600">{t("copyright")} {t("allRightsReserved")}</p>
            
            {/* Contact & Social */}
            <div className="flex items-center gap-6">
              {/* Contact Info */}
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-600" />
                <a href="tel:+250791998365" className="text-sm text-gray-900 hover:text-gray-600 transition-colors">
                  0791998365
                </a>
              </div>

              {/* Instagram Icon */}
              <a
                href="https://instagram.com/trippoltd"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-900 hover:text-pink-600 transition-colors"
                aria-label="Follow us on Instagram @trippoltd"
              >
                <Instagram className="w-5 h-5" />
              </a>
            </div>
            
            {/* Language Selector */}
            <div className="flex items-center gap-2 border border-gray-200 rounded-lg bg-white px-3 py-1.5">
              <Globe className="w-4 h-4 text-gray-600" />
              <Select value={language} onValueChange={(value: "en" | "rw") => setLanguage(value)}>
                <SelectTrigger className="border-0 h-auto p-0 w-auto min-w-[100px] focus:ring-0 focus:ring-offset-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="rw">Kinyarwanda</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
