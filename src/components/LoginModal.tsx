import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePinAuth } from "@/hooks/usePinAuth";
import { useToast } from "@/hooks/use-toast";
import { authApi } from "@/lib/api";
import { Lock, User, Mail } from "lucide-react";

interface LoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: "login" | "create";
}

export function LoginModal({ open, onOpenChange, defaultTab = "login" }: LoginModalProps) {
  const navigate = useNavigate();
  const { setPin } = usePinAuth(); // Still use setPin for backward compatibility
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<"login" | "create">(defaultTab);
  const [loginPin, setLoginPin] = useState("");
  const [createPin, setCreatePin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    loginPin?: string;
    createPin?: string;
    confirmPin?: string;
    name?: string;
    email?: string;
  }>({});
  
  const loginPinRef = useRef<HTMLInputElement>(null);
  const createPinRef = useRef<HTMLInputElement>(null);

  // Reset form when modal opens/closes or tab changes
  useEffect(() => {
    if (open) {
      setActiveTab(defaultTab);
      setLoginPin("");
      setCreatePin("");
      setConfirmPin("");
      setName("");
      setEmail("");
      setLoginEmail("");
      setErrors({});
      
      // Focus appropriate input
      setTimeout(() => {
        if (defaultTab === "login" && loginPinRef.current) {
          loginPinRef.current.focus();
        } else if (defaultTab === "create" && createPinRef.current) {
          createPinRef.current.focus();
        }
      }, 100);
    }
  }, [open, defaultTab]);

  const handleLoginPinChange = (value: string) => {
    const numericValue = value.replace(/\D/g, "").slice(0, 4);
    setLoginPin(numericValue);
    setErrors((prev) => ({ ...prev, loginPin: undefined }));
    
    // Auto-submit when 4 digits are entered
    if (numericValue.length === 4 && !isLoading) {
      handleLogin();
    }
  };

  const handleLogin = async () => {
    if (loginPin.length !== 4) {
      setErrors((prev) => ({ ...prev, loginPin: "PIN must be 4 digits" }));
      return;
    }

    setIsLoading(true);
    setErrors((prev) => ({ ...prev, loginPin: undefined }));

    try {
      const response = await authApi.login({ 
        pin: loginPin,
        email: loginEmail.trim() || undefined 
      });

      if (response.user) {
        // Check if admin login
        if (response.isAdmin || response.user.email === 'admin') {
          // Store admin info
          localStorage.setItem("profit-pilot-user-name", response.user.name || "Admin");
          localStorage.setItem("profit-pilot-user-email", "admin");
          localStorage.setItem("profit-pilot-business-name", "System Administrator");
          localStorage.setItem("profit-pilot-is-admin", "true");
          
          // Dispatch event
          window.dispatchEvent(new Event("user-data-changed"));
          
          toast({
            title: "Admin Login Successful",
            description: "Welcome, Administrator!",
          });
          
          onOpenChange(false);
          navigate("/admin-dashboard");
          return;
        }

        // Store PIN in localStorage for backward compatibility
        setPin(loginPin);
        
        // Store user info and ID
        if (response.user.name) {
          localStorage.setItem("profit-pilot-user-name", response.user.name);
        }
        if (response.user.email) {
          localStorage.setItem("profit-pilot-user-email", response.user.email);
        }
        if (response.user.businessName) {
          localStorage.setItem("profit-pilot-business-name", response.user.businessName);
        }
        // Store user ID for API requests
        if (response.user._id || response.user.id) {
          localStorage.setItem("profit-pilot-user-id", response.user._id || response.user.id);
        }

        // Trigger user data update event
        window.dispatchEvent(new Event("user-data-changed"));

        toast({
          title: "Welcome back!",
          description: "You have successfully logged in.",
        });
        onOpenChange(false);
        navigate("/dashboard");
      }
    } catch (error: any) {
      const errorMessage = error.response?.error || error.message || "Login failed. Please try again.";
      setErrors((prev) => ({ ...prev, loginPin: errorMessage }));
      setLoginPin("");
      setTimeout(() => loginPinRef.current?.focus(), 100);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePinChange = (value: string) => {
    const numericValue = value.replace(/\D/g, "").slice(0, 4);
    setCreatePin(numericValue);
    setErrors((prev) => ({ ...prev, createPin: undefined }));
  };

  const handleConfirmPinChange = (value: string) => {
    const numericValue = value.replace(/\D/g, "").slice(0, 4);
    setConfirmPin(numericValue);
    setErrors((prev) => ({ ...prev, confirmPin: undefined }));
  };

  const handleCreateAccount = async () => {
    const newErrors: typeof errors = {};

    // Validate name
    if (!name.trim()) {
      newErrors.name = "Name is required";
    }

    // Validate email (optional)
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Please enter a valid email address";
    }

    // Validate PIN
    if (createPin.length !== 4) {
      newErrors.createPin = "PIN must be 4 digits";
    }

    // Validate PIN confirmation
    if (confirmPin.length !== 4) {
      newErrors.confirmPin = "Please confirm your PIN";
    } else if (createPin !== confirmPin) {
      newErrors.confirmPin = "PINs do not match";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const response = await authApi.register({
        name: name.trim(),
        email: email.trim() || undefined,
        pin: createPin,
      });

      if (response.user) {
        // Store PIN in localStorage for backward compatibility
        setPin(createPin);
        
        // Store user info and ID
        if (response.user.name) {
          localStorage.setItem("profit-pilot-user-name", response.user.name);
        }
        if (response.user.email) {
          localStorage.setItem("profit-pilot-user-email", response.user.email);
        }
        if (response.user.businessName) {
          localStorage.setItem("profit-pilot-business-name", response.user.businessName);
        }
        // Store user ID for API requests
        if (response.user._id || response.user.id) {
          localStorage.setItem("profit-pilot-user-id", response.user._id || response.user.id);
        }

        // Trigger user data update event
        window.dispatchEvent(new Event("user-data-changed"));

        toast({
          title: "Account created!",
          description: "Welcome to Trippo. Your account has been created successfully.",
        });
        
        onOpenChange(false);
        navigate("/dashboard");
      }
    } catch (error: any) {
      const errorMessage = error.response?.error || error.message || "Failed to create account. Please try again.";
      
      // Set appropriate error field
      if (errorMessage.includes("email")) {
        setErrors((prev) => ({ ...prev, email: errorMessage }));
      } else if (errorMessage.includes("PIN")) {
        setErrors((prev) => ({ ...prev, createPin: errorMessage }));
      } else {
        setErrors((prev) => ({ ...prev, createPin: errorMessage }));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>, action: () => void) => {
    if (e.key === "Enter") {
      action();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Welcome to Trippo</DialogTitle>
          <DialogDescription>
            Sign in to your account or create a new one to get started
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "login" | "create")} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="create">Create Account</TabsTrigger>
          </TabsList>

          {/* Login Tab */}
          <TabsContent value="login" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="login-email" className="flex items-center gap-2">
                <Mail size={16} />
                Email (Optional)
              </Label>
              <Input
                id="login-email"
                type="email"
                value={loginEmail}
                onChange={(e) => {
                  setLoginEmail(e.target.value);
                  setErrors((prev) => ({ ...prev, email: undefined }));
                }}
                placeholder="Enter your email (optional)"
                className={errors.email ? "border-red-500" : ""}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-pin" className="flex items-center gap-2">
                <Lock size={16} />
                Enter your PIN
              </Label>
              <Input
                id="login-pin"
                ref={loginPinRef}
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={loginPin}
                onChange={(e) => handleLoginPinChange(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, handleLogin)}
                placeholder="Enter 4-digit PIN"
                className={errors.loginPin ? "border-red-500" : ""}
                disabled={isLoading}
              />
              {errors.loginPin && (
                <p className="text-sm text-red-500">{errors.loginPin}</p>
              )}
            </div>
            <Button
              onClick={handleLogin}
              className="w-full bg-blue-500 text-white hover:bg-blue-600"
              disabled={loginPin.length !== 4 || isLoading}
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </TabsContent>

          {/* Create Account Tab */}
          <TabsContent value="create" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-2">
                <User size={16} />
                Full Name
              </Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setErrors((prev) => ({ ...prev, name: undefined }));
                }}
                placeholder="Enter your full name"
                className={errors.name ? "border-red-500" : ""}
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail size={16} />
                Email (Optional)
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrors((prev) => ({ ...prev, email: undefined }));
                }}
                placeholder="Enter your email"
                className={errors.email ? "border-red-500" : ""}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-pin" className="flex items-center gap-2">
                <Lock size={16} />
                Create PIN (4 digits)
              </Label>
              <Input
                id="create-pin"
                ref={createPinRef}
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={createPin}
                onChange={(e) => handleCreatePinChange(e.target.value)}
                placeholder="Enter 4-digit PIN"
                className={errors.createPin ? "border-red-500" : ""}
              />
              {errors.createPin && (
                <p className="text-sm text-red-500">{errors.createPin}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-pin" className="flex items-center gap-2">
                <Lock size={16} />
                Confirm PIN
              </Label>
              <Input
                id="confirm-pin"
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={confirmPin}
                onChange={(e) => handleConfirmPinChange(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, handleCreateAccount)}
                placeholder="Re-enter 4-digit PIN"
                className={errors.confirmPin ? "border-red-500" : ""}
              />
              {errors.confirmPin && (
                <p className="text-sm text-red-500">{errors.confirmPin}</p>
              )}
            </div>

            <Button
              onClick={handleCreateAccount}
              className="w-full bg-blue-500 text-white hover:bg-blue-600"
              disabled={isLoading}
            >
              {isLoading ? "Creating account..." : "Create Account"}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
