import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { AddToHomeScreen } from "@/components/AddToHomeScreen";
import { SplashScreen } from "@/components/SplashScreen";
import { NotificationManager } from "@/components/NotificationManager";
import { StockUpdateDialog } from "@/components/StockUpdateDialog";
import { useSyncReminder } from "@/hooks/useSyncReminder";
import { initAudio } from "@/lib/sound";
import { LanguageProvider } from "@/hooks/useLanguage";
import { ThemeProvider } from "@/hooks/useTheme";
import Home from "./pages/Home";
import Index from "./pages/Index";
import Products from "./pages/Products";
import AddProduct from "./pages/AddProduct";
import Sales from "./pages/Sales";
import Clients from "./pages/Clients";
import Schedules from "./pages/Schedules";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  // State for stock update dialog from notification
  const [stockUpdateDialogOpen, setStockUpdateDialogOpen] = useState(false);
  const [stockUpdateProductId, setStockUpdateProductId] = useState<string | number | null>(null);
  const [stockUpdateProductName, setStockUpdateProductName] = useState<string | undefined>(undefined);
  const [stockUpdateCurrentStock, setStockUpdateCurrentStock] = useState<number | undefined>(undefined);
  const [stockUpdateMinStock, setStockUpdateMinStock] = useState<number | undefined>(undefined);

  // Enable sync reminder notifications
  useSyncReminder();

  // Initialize audio on app load
  useEffect(() => {
    // Initialize audio context on first user interaction
    const initAudioOnInteraction = () => {
      initAudio();
      // Remove listeners after initialization
      document.removeEventListener('click', initAudioOnInteraction);
      document.removeEventListener('keydown', initAudioOnInteraction);
      document.removeEventListener('touchstart', initAudioOnInteraction);
    };

    // Try to initialize immediately
    initAudio();

    // Also listen for user interactions to ensure audio is ready
    document.addEventListener('click', initAudioOnInteraction, { once: true });
    document.addEventListener('keydown', initAudioOnInteraction, { once: true });
    document.addEventListener('touchstart', initAudioOnInteraction, { once: true });

    return () => {
      document.removeEventListener('click', initAudioOnInteraction);
      document.removeEventListener('keydown', initAudioOnInteraction);
      document.removeEventListener('touchstart', initAudioOnInteraction);
    };
  }, []);

  // Listen for service worker messages (notification clicks)
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handleMessage = (event: MessageEvent) => {
        if (event.data && event.data.type === 'SHOW_STOCK_UPDATE') {
          setStockUpdateProductId(event.data.productId);
          setStockUpdateProductName(event.data.productName);
          setStockUpdateCurrentStock(event.data.currentStock);
          setStockUpdateMinStock(event.data.minStock);
          setStockUpdateDialogOpen(true);
        }
      };

      navigator.serviceWorker.addEventListener('message', handleMessage);

      return () => {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      };
    }
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ThemeProvider>
          <LanguageProvider>
            <SplashScreen />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute>
                    <Index />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/products" 
                element={
                  <ProtectedRoute>
                    <Products />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/products/add" 
                element={
                  <ProtectedRoute>
                    <AddProduct />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/sales" 
                element={
                  <ProtectedRoute>
                    <Sales />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/clients" 
                element={
                  <ProtectedRoute>
                    <Clients />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/schedules" 
                element={
                  <ProtectedRoute>
                    <Schedules />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/reports" 
                element={
                  <ProtectedRoute>
                    <Reports />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/settings" 
                element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin-dashboard" 
                element={
                  <ProtectedRoute requireAdmin={true}>
                    <AdminDashboard />
                  </ProtectedRoute>
                } 
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <OfflineIndicator />
            <NotificationManager />
            <StockUpdateDialog
              productId={stockUpdateProductId}
              productName={stockUpdateProductName}
              currentStock={stockUpdateCurrentStock}
              open={stockUpdateDialogOpen}
              onOpenChange={setStockUpdateDialogOpen}
            />
          </LanguageProvider>
        </ThemeProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);
};

export default App;
