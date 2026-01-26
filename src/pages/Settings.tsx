import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { 
  Building2, 
  Lock, 
  User, 
  Mail, 
  Save,
  Shield,
  Globe,
  Trash2,
  AlertTriangle,
  LogOut
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { playUpdateBeep, playErrorBeep, playWarningBeep, initAudio } from "@/lib/sound";
import { usePinAuth } from "@/hooks/usePinAuth";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { authApi } from "@/lib/api";
import { useLanguage } from "@/hooks/useLanguage";
import { useTranslation } from "@/hooks/useTranslation";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type SettingsSection = "business" | "security" | "language" | "account";

const Settings = () => {
  const { toast } = useToast();
  const { hasPin, setPin, changePin, getPinStatus, clearAuth } = usePinAuth();
  const { user, updateUser, clearUser } = useCurrentUser();
  const { language, setLanguage } = useLanguage();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<SettingsSection>("business");
  const [businessName, setBusinessName] = useState(user?.businessName || "");
  const [ownerName, setOwnerName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [pinMode, setPinMode] = useState<"set" | "change">("set");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  // Load user data when component mounts or user changes
  useEffect(() => {
    const loadUserData = async () => {
      // Get current userId from localStorage to ensure we don't switch users
      const currentUserId = localStorage.getItem("profit-pilot-user-id");
      
      // Only load from backend if we have a userId and it matches current user
      if (currentUserId && user) {
        try {
          // Try to load from backend first, but verify it's the same user
          const response = await authApi.getCurrentUser();
          if (response?.user) {
            const backendUser = response.user;
            const backendUserId = (backendUser as any)._id || (backendUser as any).id;
            
            // Only update if the backend user matches the current logged-in user
            // This prevents auto-switching users
            if (backendUserId && backendUserId.toString() === currentUserId.toString()) {
              setOwnerName(backendUser.name || user?.name || "");
              setEmail(backendUser.email || user?.email || "");
              setBusinessName(backendUser.businessName || user?.businessName || "");
            } else {
              // Backend returned different user - use localStorage data instead
              console.warn("Backend user ID mismatch, using localStorage data");
              setOwnerName(user?.name || "");
              setEmail(user?.email || "");
              setBusinessName(user?.businessName || "");
            }
          } else {
            // No backend user, use localStorage
            setOwnerName(user?.name || "");
            setEmail(user?.email || "");
            setBusinessName(user?.businessName || "");
          }
        } catch (error) {
          // If backend fails, use localStorage data (don't switch users)
          console.error("Failed to load user from backend:", error);
          if (user) {
            setOwnerName(user.name || "");
            setEmail(user.email || "");
            setBusinessName(user.businessName || "");
          }
        }
      } else if (user) {
        // No userId or no user in localStorage, just use what we have
        setOwnerName(user.name || "");
        setEmail(user.email || "");
        setBusinessName(user.businessName || "");
      }
    };

    loadUserData();
  }, [user]); // Removed updateUser from dependencies to prevent unnecessary re-runs

  const handleSaveBusinessInfo = async () => {
    initAudio();
    
    // Validate required fields
    if (!ownerName.trim()) {
      playErrorBeep();
      toast({
        title: "Validation Error",
        description: "Owner name is required.",
        variant: "destructive",
      });
      return;
    }

    // Validate email format if provided
    if (email && email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      playErrorBeep();
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Verify we still have the same userId before updating
      const currentUserId = localStorage.getItem("profit-pilot-user-id");
      if (!currentUserId) {
        playErrorBeep();
        toast({
          title: "Session Error",
          description: "User session not found. Please log in again.",
          variant: "destructive",
        });
        return;
      }

      // Update user data in backend
      await authApi.updateUser({
        name: ownerName.trim(),
        email: email.trim() || undefined,
        businessName: businessName.trim() || undefined,
      });

      // Verify userId hasn't changed before updating localStorage
      const userIdAfterUpdate = localStorage.getItem("profit-pilot-user-id");
      if (userIdAfterUpdate === currentUserId) {
        // Only update localStorage if userId hasn't changed (prevent user switching)
        updateUser({
          name: ownerName.trim(),
          email: email.trim() || undefined,
          businessName: businessName.trim() || undefined,
        });
      } else {
        console.warn("User ID changed during update, skipping localStorage update");
      }
      
    playUpdateBeep();
    toast({
      title: "Settings Saved",
        description: "Business information has been updated successfully.",
      });
    } catch (error: any) {
      playErrorBeep();
      toast({
        title: "Save Failed",
        description: error?.message || "Failed to update business information. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSetPin = async () => {
    initAudio();
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      playErrorBeep();
      toast({
        title: "Invalid PIN",
        description: "PIN must be exactly 4 digits.",
        variant: "destructive",
      });
      return;
    }
    if (newPin !== confirmPin) {
      playErrorBeep();
      toast({
        title: "PIN Mismatch",
        description: "PIN and confirmation do not match.",
        variant: "destructive",
      });
      return;
    }

    try {
      // For setting a new PIN, we need to get the current user's PIN
      // Since this is a new PIN setup, we'll use the login endpoint to verify
      // But actually, if there's no PIN set, we should just set it locally first
      // and then sync to backend on next login
      
      // Set PIN locally for backward compatibility
      if (setPin(newPin)) {
    playUpdateBeep();
    toast({
          title: "PIN Set",
          description: "Your PIN has been set successfully.",
        });
        setNewPin("");
        setConfirmPin("");
        setCurrentPin("");
        setPinMode("change");
      }
    } catch (error: any) {
      playErrorBeep();
      toast({
        title: "PIN Setup Failed",
        description: error?.message || "Failed to set PIN. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleChangePin = async () => {
    initAudio();
    if (currentPin.length !== 4 || !/^\d{4}$/.test(currentPin)) {
      playErrorBeep();
      toast({
        title: "Invalid Current PIN",
        description: "Current PIN must be exactly 4 digits.",
        variant: "destructive",
      });
      return;
    }
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      playErrorBeep();
      toast({
        title: "Invalid PIN",
        description: "New PIN must be exactly 4 digits.",
        variant: "destructive",
      });
      return;
    }
    if (newPin !== confirmPin) {
      playErrorBeep();
      toast({
        title: "PIN Mismatch",
        description: "New PIN and confirmation do not match.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Update PIN in backend
      await authApi.changePin({
        currentPin,
        newPin,
      });

      // Also update PIN locally for backward compatibility
      if (changePin(currentPin, newPin)) {
    playUpdateBeep();
    toast({
          title: "PIN Changed",
          description: "Your PIN has been changed successfully.",
        });
        setNewPin("");
        setConfirmPin("");
        setCurrentPin("");
      } else {
        // This shouldn't happen if backend succeeded, but handle it just in case
        playErrorBeep();
        toast({
          title: "PIN Update Incomplete",
          description: "PIN was updated on server but local update failed. Please refresh.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      playErrorBeep();
      const errorMessage = error?.message || "Failed to change PIN. Please try again.";
      if (errorMessage.toLowerCase().includes("incorrect") || errorMessage.toLowerCase().includes("invalid")) {
        toast({
          title: "Invalid Current PIN",
          description: "The current PIN you entered is incorrect.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "PIN Change Failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
    }
  };

  const handleLogoutClick = () => {
    setLogoutDialogOpen(true);
  };

  const handleLogoutConfirm = async () => {
    initAudio();
    // Clear authentication state
    clearAuth();
    
    // Clear user ID and all user data
    localStorage.removeItem("profit-pilot-user-id");
    localStorage.removeItem("profit-pilot-user-name");
    localStorage.removeItem("profit-pilot-user-email");
    localStorage.removeItem("profit-pilot-business-name");
    localStorage.removeItem("profit-pilot-is-admin");
    localStorage.removeItem("profit-pilot-authenticated");
    
    // Clear session storage completely
    sessionStorage.clear();
    
    // Clear IndexedDB data (for complete data isolation)
    try {
      const { clearAllStores } = await import("@/lib/indexedDB");
      await clearAllStores();
    } catch (error) {
      console.error("Error clearing IndexedDB on logout:", error);
    }
    
    // Dispatch authentication change event
    window.dispatchEvent(new Event("pin-auth-changed"));
    
    // Show logout confirmation
    toast({
      title: language === "rw" ? "Wasohotse" : "Logged Out",
      description: language === "rw" 
        ? "Wasohotse neza. Amakuru yose yarakurwaho." 
        : "You have been successfully logged out. All your data has been cleared.",
    });
    
    setLogoutDialogOpen(false);
    
    // Clear browser history and redirect to homepage
    window.history.replaceState(null, "", "/");
    
    // Navigate to home page
    navigate("/", { replace: true });
  };

  const handleDeleteAccount = async () => {
    initAudio();
    setIsDeleting(true);

    try {
      // Delete account from backend
      await authApi.deleteAccount();

      // Clear authentication state
      clearAuth();

      // Clear all user data from localStorage
      clearUser();
      localStorage.removeItem("profit-pilot-user-id");
      localStorage.removeItem("profit-pilot-user-name");
      localStorage.removeItem("profit-pilot-user-email");
      localStorage.removeItem("profit-pilot-business-name");
      localStorage.removeItem("profit-pilot-is-admin");

      // Clear session storage
      sessionStorage.clear();

      // Clear IndexedDB data
      try {
        const { clearAllStores } = await import("@/lib/indexedDB");
        await clearAllStores();
      } catch (error) {
        console.error("Error clearing IndexedDB on account deletion:", error);
      }

      // Dispatch authentication change event
      window.dispatchEvent(new Event("pin-auth-changed"));

      playUpdateBeep();
      toast({
        title: language === "rw" ? "Konti Yarahagijwe" : "Account Deleted",
        description: language === "rw"
          ? "Konti yawe n'amakuru yose byarahagijwe neza."
          : "Your account and all data have been successfully deleted.",
      });

      // Redirect to home page
      setTimeout(() => {
        window.history.replaceState(null, "", "/");
        navigate("/", { replace: true });
      }, 1000);
    } catch (error: any) {
      playErrorBeep();
      toast({
        title: language === "rw" ? "Ikosa" : "Error",
        description: error?.message || (language === "rw"
          ? "Ntibyashoboye kuraho konti. Nyamuneka gerageza nanone."
          : "Failed to delete account. Please try again."),
        variant: "destructive",
      });
      setIsDeleting(false);
    }
  };

  return (
    <AppLayout title="Settings">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Left Sidebar - Navigation */}
          <div className="lg:col-span-1">
            <div className="form-card p-0 overflow-hidden border-primary/30">
              <div 
                className="p-4 border-b border-blue-200 relative"
                style={{
                  backgroundImage: 'url(/banner.jpg)',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat'
                }}
              >
                <div className="absolute inset-0 bg-blue-600/20"></div>
                <div className="relative z-10 flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/90 border border-white/50 rounded-lg flex items-center justify-center">
                    <User size={18} className="text-blue-600 font-bold" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-white text-sm truncate drop-shadow-md">{ownerName}</h3>
                    <p className="text-xs text-white/90 truncate drop-shadow-md">{email}</p>
                  </div>
                </div>
              </div>
              <div className="p-3 space-y-1.5">
                <button 
                  onClick={() => setActiveSection("business")}
                  className={cn(
                    "w-full text-left px-3 py-2.5 transition-all duration-200 text-sm rounded-lg",
                    activeSection === "business"
                      ? "bg-blue-600 text-white border border-transparent font-semibold"
                      : "hover:bg-blue-50 text-gray-700 border border-transparent"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Building2 size={16} className={activeSection === "business" ? "text-white" : "text-blue-600"} />
                    {t("businessInfo")}
                  </div>
                </button>
                <button 
                  onClick={() => setActiveSection("language")}
                  className={cn(
                    "w-full text-left px-3 py-2.5 transition-all duration-200 text-sm rounded-lg",
                    activeSection === "language"
                      ? "bg-blue-600 text-white border border-transparent font-semibold"
                      : "hover:bg-blue-50 text-gray-700 border border-transparent"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Globe size={16} className={activeSection === "language" ? "text-white" : "text-blue-600"} />
                    {t("language")}
                  </div>
                </button>
                <button 
                  onClick={() => setActiveSection("security")}
                  className={cn(
                    "w-full text-left px-3 py-2.5 transition-all duration-200 text-sm rounded-lg",
                    activeSection === "security"
                      ? "bg-blue-600 text-white border border-transparent font-semibold"
                      : "hover:bg-blue-50 text-gray-700 border border-transparent"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Shield size={16} className={activeSection === "security" ? "text-white" : "text-blue-600"} />
                    {t("security")}
                  </div>
                </button>
                <button 
                  onClick={() => setActiveSection("account")}
                  className={cn(
                    "w-full text-left px-3 py-2.5 transition-all duration-200 text-sm rounded-lg",
                    activeSection === "account"
                      ? "bg-red-600 text-white border border-transparent font-semibold"
                      : "hover:bg-red-50 text-gray-700 border border-transparent"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Trash2 size={16} className={activeSection === "account" ? "text-white" : "text-red-600"} />
                    {language === "rw" ? "Kuraho Konti" : "Delete Account"}
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3">
            {/* Business Information */}
            {activeSection === "business" && (
              <div className="form-card border border-transparent bg-white animate-fade-in">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-100 border border-blue-200 flex items-center justify-center">
                    <Building2 size={16} className="text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-blue-700">{t("businessInfo")}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">{language === "rw" ? "Hindura amakuru y'ubucuruzi" : "Update your business details"}</p>
                  </div>
                </div>
              </div>
              
              <Separator className="mb-4 bg-blue-200" />

              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <Building2 size={12} className="text-blue-600" />
                      {t("businessName")}
                    </Label>
                    <Input
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className="input-field h-10 bg-background text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder="Enter business name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <User size={12} className="text-blue-600" />
                      {t("ownerName")}
                    </Label>
                    <Input
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      className="input-field h-10 bg-background text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder="Enter owner name"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <Mail size={12} className="text-blue-600" />
                    {t("emailAddress")}
                  </Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field h-10 bg-background text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="Enter email address"
                  />
                </div>
              </div>

              <Separator className="my-4" />

              <div className="flex justify-end">
                <Button 
                  onClick={handleSaveBusinessInfo} 
                  className="bg-blue-600 text-white hover:bg-blue-700 gap-2 h-10 px-5 text-sm shadow-sm hover:shadow transition-all font-semibold rounded-lg"
                >
                  <Save size={14} />
                  {t("saveChanges")}
                </Button>
              </div>
              </div>
            )}

            {/* Language Settings */}
            {activeSection === "language" && (
              <div className="form-card border border-transparent bg-white animate-fade-in">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-blue-100 border border-blue-200 flex items-center justify-center">
                      <Globe size={16} className="text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-blue-700">{t("language")}</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">{language === "rw" ? "Hitamo ururimi wifuza gukoresha" : "Choose your preferred language"}</p>
                    </div>
                  </div>
                </div>
                
                <Separator className="mb-4 bg-blue-200" />

                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <Globe size={12} className="text-blue-600" />
                      {language === "rw" ? "Hitamo ururimi" : "Select Language"}
                    </Label>
                    <Select value={language} onValueChange={(value: "en" | "rw") => setLanguage(value)}>
                      <SelectTrigger className="input-field h-10 bg-background text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="rw">Kinyarwanda</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      {language === "rw" 
                        ? "Ururimi rwose ruzahinduka mu buryo bwikora" 
                        : "The entire interface will update to your selected language"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Security */}
            {activeSection === "security" && (
              <div className="form-card border border-transparent bg-white animate-fade-in">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-100 border border-blue-200 flex items-center justify-center">
                    <Shield size={16} className="text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-blue-700">{t("security")}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">{language === "rw" ? "Shiraho PIN kugirango wongere umutekano" : "Set PIN to keep your account secure"}</p>
                  </div>
                </div>
              </div>
              
              <Separator className="mb-4 bg-blue-200" />

              <div className="space-y-6">
                {/* PIN Settings */}
              <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Lock size={14} className="text-blue-600" />
                        Financial Data PIN Protection
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {hasPin 
                          ? "PIN is set. Profits and sensitive financial data are protected." 
                          : "Set a 4-digit PIN to protect profits and sensitive financial information."}
                      </p>
                    </div>
                    {hasPin && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPinMode(pinMode === "set" ? "change" : "set")}
                        className="text-xs"
                      >
                        {pinMode === "set" ? "Change PIN" : "Set New PIN"}
                      </Button>
                    )}
                  </div>

                  {hasPin && pinMode === "change" && (
                    <div className="space-y-3 p-4 bg-secondary/30 border border-transparent rounded-lg">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-foreground">{t("currentPin")}</Label>
                        <Input
                          type="password"
                          inputMode="numeric"
                          maxLength={4}
                          value={currentPin}
                          onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                          className="input-field h-10 bg-background text-center text-lg tracking-widest font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          placeholder="••••"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-foreground">{t("newPin")}</Label>
                          <Input
                            type="password"
                            inputMode="numeric"
                            maxLength={4}
                            value={newPin}
                            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                            className="input-field h-10 bg-background text-center text-lg tracking-widest font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            placeholder="••••"
                          />
                </div>
                  <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-foreground">{t("confirmPin")}</Label>
                      <Input
                            type="password"
                            inputMode="numeric"
                            maxLength={4}
                            value={confirmPin}
                            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                            className="input-field h-10 bg-background text-center text-lg tracking-widest font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            placeholder="••••"
                          />
                        </div>
                      </div>
                      <Button
                        onClick={handleChangePin}
                        className="bg-blue-600 text-white hover:bg-blue-700 w-full gap-2 h-10 shadow-sm hover:shadow transition-all font-semibold rounded-lg"
                        disabled={currentPin.length !== 4 || newPin.length !== 4 || confirmPin.length !== 4}
                      >
                        <Lock size={14} />
                        {t("changePin")}
                      </Button>
                    </div>
                  )}

                  {(!hasPin || pinMode === "set") && (
                    <div className="space-y-3 p-4 bg-secondary/30 border border-transparent rounded-lg">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-foreground">{t("newPin")}</Label>
                          <Input
                            type="password"
                            inputMode="numeric"
                            maxLength={4}
                            value={newPin}
                            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                            className="input-field h-10 bg-background text-center text-lg tracking-widest font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            placeholder="••••"
                          />
                  </div>
                  <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-foreground">{t("confirmPin")}</Label>
                      <Input
                            type="password"
                            inputMode="numeric"
                            maxLength={4}
                            value={confirmPin}
                            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                            className="input-field h-10 bg-background text-center text-lg tracking-widest font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            placeholder="••••"
                          />
                        </div>
                      </div>
                      <Button
                        onClick={handleSetPin}
                        className="bg-blue-600 text-white hover:bg-blue-700 w-full gap-2 h-10 shadow-sm hover:shadow transition-all font-semibold rounded-lg"
                        disabled={newPin.length !== 4 || confirmPin.length !== 4}
                      >
                        <Lock size={14} />
                        {hasPin ? (language === "rw" ? "Hindura PIN" : "Update PIN") : t("setPin")}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              </div>
            )}

            {/* Delete Account */}
            {activeSection === "account" && (
              <div className="form-card border border-transparent bg-white animate-fade-in">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-red-100 border border-red-200 flex items-center justify-center">
                      <Trash2 size={16} className="text-red-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-red-700">
                        {language === "rw" ? "Kuraho Konti" : "Delete Account"}
                      </h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {language === "rw" 
                          ? "Iki gikorwa ntigisubirwamo - konti yawe n'amakuru yose azakurwa" 
                          : "This action cannot be undone - your account and all data will be permanently deleted"}
                      </p>
                    </div>
                  </div>
                </div>
                
                <Separator className="mb-4 bg-red-200" />

                <div className="space-y-4">
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertTriangle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-red-900">
                          {language === "rw" ? "Icyitonderwa" : "Warning"}
                        </h3>
                        <p className="text-xs text-red-800">
                          {language === "rw"
                            ? "Kuraho konti yawe bizakurura:"
                            : "Deleting your account will permanently remove:"}
                        </p>
                        <ul className="text-xs text-red-800 list-disc list-inside space-y-1 ml-2">
                          <li>{language === "rw" ? "Amakuru yose y'ubucuruzi" : "All business information"}</li>
                          <li>{language === "rw" ? "Ibicuruzwa byose" : "All products"}</li>
                          <li>{language === "rw" ? "Abacuruzi bose" : "All clients"}</li>
                          <li>{language === "rw" ? "Amakuru yose y'ubucuruzi" : "All sales records"}</li>
                          <li>{language === "rw" ? "Amakuru yose y'itegeko" : "All schedules"}</li>
                          <li>{language === "rw" ? "Amakuru yose y'umukoresha" : "All user data"}</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={() => setDeleteDialogOpen(true)}
                    variant="destructive"
                    className="w-full gap-2 h-10 shadow-sm hover:shadow transition-all font-semibold rounded-lg"
                  >
                    <Trash2 size={14} />
                    {language === "rw" ? "Kuraho Konti" : "Delete My Account"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Logout Button - Only visible on mobile */}
      <div className="lg:hidden mt-6">
        <div className="form-card border border-transparent bg-white">
          <Button
            onClick={handleLogoutClick}
            variant="outline"
            className="w-full gap-2 h-12 text-red-600 border-red-300 hover:bg-red-50 hover:border-red-400 transition-all font-semibold rounded-lg"
          >
            <LogOut size={18} />
            {t("logout")}
          </Button>
        </div>
      </div>

      {/* Delete Account Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle size={20} />
              {language === "rw" ? "Kuraho Konti" : "Delete Account"}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                {language === "rw"
                  ? "Urabyemera ko wifuza kuraho konti yawe? Iki gikorwa ntigisubirwamo."
                  : "Are you sure you want to delete your account? This action cannot be undone."}
              </p>
              <p className="font-semibold text-red-600">
                {language === "rw"
                  ? "Amakuru yose azakurwa gusa."
                  : "All your data will be permanently deleted."}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {language === "rw" ? "Guhagarika" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting 
                ? (language === "rw" ? "Kuraho..." : "Deleting...") 
                : (language === "rw" ? "Yego, Kuraho" : "Yes, Delete Account")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Logout Confirmation Dialog */}
      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("logout")}</AlertDialogTitle>
            <AlertDialogDescription>
              {language === "rw" 
                ? "Urasabye gusohoka? Uzakenera kwinjira nanone kugirango wongere wongere ikibaho." 
                : "Are you sure you want to logout? You will need to login again to access your dashboard."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {language === "rw" ? "Guhagarika" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogoutConfirm}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {t("logout")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Logout Confirmation Dialog */}
      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("logout")}</AlertDialogTitle>
            <AlertDialogDescription>
              {language === "rw" 
                ? "Urasabye gusohoka? Uzakenera kwinjira nanone kugirango wongere wongere ikibaho." 
                : "Are you sure you want to logout? You will need to login again to access your dashboard."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {language === "rw" ? "Guhagarika" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogoutConfirm}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {t("logout")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default Settings;
