import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
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
import { Lock, User, Mail, Phone } from "lucide-react";

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
  const [phone, setPhone] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPin, setShowForgotPin] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [errors, setErrors] = useState<{
    loginPin?: string;
    createPin?: string;
    confirmPin?: string;
    name?: string;
    email?: string;
    phone?: string;
    resetEmail?: string;
    otp?: string;
    newPin?: string;
    confirmNewPin?: string;
  }>({});
  
  const loginPinRef = useRef<HTMLInputElement>(null);
  const createPinRef = useRef<HTMLInputElement>(null);
  const otpRef = useRef<HTMLInputElement>(null);

  // Reset form when modal opens/closes or tab changes
  useEffect(() => {
    if (open) {
      setActiveTab(defaultTab);
      setLoginPin("");
      setCreatePin("");
      setConfirmPin("");
      setName("");
      setEmail("");
      setPhone("");
      setLoginEmail("");
      setShowForgotPin(false);
      setResetEmail("");
      setOtp("");
      setNewPin("");
      setConfirmNewPin("");
      setOtpSent(false);
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
    
    // Show error ONLY if PIN is not equal to 4 digits and has a value
    if (numericValue.length > 0 && numericValue.length !== 4) {
      setErrors((prev) => ({ ...prev, loginPin: "PIN must be 4 digits" }));
    } else {
      // Clear error when PIN is exactly 4 digits or empty
      setErrors((prev) => ({ ...prev, loginPin: undefined }));
    }
    
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

    if (!loginEmail.trim()) {
      setErrors((prev) => ({ ...prev, email: "Email is required" }));
      return;
    }

    setIsLoading(true);
    setErrors((prev) => ({ ...prev, loginPin: undefined, email: undefined }));

    try {
      const response = await authApi.login({ 
        pin: loginPin,
        email: loginEmail.trim()
      });

      if (response.user) {
        // Check if admin login
        if (response.isAdmin || response.user.email === 'admin') {
          // Store admin info
          localStorage.setItem("profit-pilot-user-name", response.user.name || "Admin");
          localStorage.setItem("profit-pilot-user-email", "admin");
          localStorage.setItem("profit-pilot-business-name", "System Administrator");
          localStorage.setItem("profit-pilot-is-admin", "true");
          
          // Store a special admin userId (required for ProtectedRoute)
          // Use a special identifier for admin since backend doesn't return _id for admin
          localStorage.setItem("profit-pilot-user-id", "admin");
          
          // Set authentication flag in localStorage for persistence
          localStorage.setItem("profit-pilot-authenticated", "true");
          
          // Dispatch authentication event
          window.dispatchEvent(new Event("pin-auth-changed"));
          
          // Dispatch event
          window.dispatchEvent(new Event("user-data-changed"));
          
          toast({
            title: "Admin Login Successful",
            description: "Welcome, Administrator!",
          });
          
          onOpenChange(false);
          navigate("/admin-dashboard", { replace: true });
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
        // Only store businessName if it exists and is not empty
        if (response.user.businessName && response.user.businessName.trim()) {
          localStorage.setItem("profit-pilot-business-name", response.user.businessName.trim());
        } else {
          // Clear businessName if it's empty or undefined
          localStorage.removeItem("profit-pilot-business-name");
        }
        // Store user ID for API requests
        if (response.user._id || response.user.id) {
          localStorage.setItem("profit-pilot-user-id", response.user._id || response.user.id);
        }

        // Set authentication flag in sessionStorage
        localStorage.setItem("profit-pilot-authenticated", "true");
        
        // Dispatch authentication event
        window.dispatchEvent(new Event("pin-auth-changed"));

        // Trigger user data update event
        window.dispatchEvent(new Event("user-data-changed"));

        toast({
          title: "Welcome back!",
          description: "You have successfully logged in.",
        });
        onOpenChange(false);
        navigate("/dashboard", { replace: true });
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
    
    // Show error if PIN is less than 4 digits and has a value
    if (numericValue.length > 0 && numericValue.length < 4) {
      setErrors((prev) => ({ ...prev, createPin: "PIN must be 4 digits" }));
    } else {
      setErrors((prev) => ({ ...prev, createPin: undefined }));
    }
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

    // Validate email (required)
    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Please enter a valid email address";
    }

    // Validate phone (required)
    if (!phone.trim()) {
      newErrors.phone = "Phone number is required";
    } else if (phone.trim().length < 10) {
      newErrors.phone = "Phone number must be at least 10 digits";
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
        email: email.trim(),
        phone: phone.trim(),
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
        // Only store businessName if it exists and is not empty
        if (response.user.businessName && response.user.businessName.trim()) {
          localStorage.setItem("profit-pilot-business-name", response.user.businessName.trim());
        } else {
          // Clear businessName if it's empty or undefined
          localStorage.removeItem("profit-pilot-business-name");
        }
        // Store user ID for API requests
        if (response.user._id || response.user.id) {
          localStorage.setItem("profit-pilot-user-id", response.user._id || response.user.id);
        }

        // Set authentication flag in sessionStorage
        localStorage.setItem("profit-pilot-authenticated", "true");
        
        // Dispatch authentication event
        window.dispatchEvent(new Event("pin-auth-changed"));
        
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

  const handleSendOTP = async () => {
    if (!resetEmail.trim()) {
      setErrors((prev) => ({ ...prev, resetEmail: "Email is required" }));
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail.trim())) {
      setErrors((prev) => ({ ...prev, resetEmail: "Please enter a valid email address" }));
      return;
    }

    setIsLoading(true);
    setErrors((prev) => ({ ...prev, resetEmail: undefined }));

    try {
      const response = await authApi.forgotPin({ email: resetEmail.trim() });
      
      if (response.message) {
        setOtpSent(true);
        toast({
          title: "OTP Sent",
          description: "If an account exists with this email, an OTP has been sent. Please check your email.",
        });
        setTimeout(() => {
          otpRef.current?.focus();
        }, 100);
      }
    } catch (error: any) {
      const errorMessage = error.response?.error || error.message || "Failed to send OTP. Please try again.";
      setErrors((prev) => ({ ...prev, resetEmail: errorMessage }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPin = async () => {
    const newErrors: typeof errors = {};

    if (!otp.trim()) {
      newErrors.otp = "OTP is required";
    } else if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      newErrors.otp = "OTP must be 6 digits";
    }

    if (!newPin.trim()) {
      newErrors.newPin = "New PIN is required";
    } else if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      newErrors.newPin = "PIN must be 4 digits";
    }

    if (!confirmNewPin.trim()) {
      newErrors.confirmNewPin = "Please confirm your PIN";
    } else if (confirmNewPin !== newPin) {
      newErrors.confirmNewPin = "PINs do not match";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...newErrors }));
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const response = await authApi.resetPin({
        email: resetEmail.trim(),
        otp: otp.trim(),
        newPin: newPin.trim(),
      });

      if (response.message) {
        toast({
          title: "PIN Reset Successful",
          description: "Your PIN has been reset. You can now login with your new PIN.",
        });
        setShowForgotPin(false);
        setResetEmail("");
        setOtp("");
        setNewPin("");
        setConfirmNewPin("");
        setOtpSent(false);
        setActiveTab("login");
        setLoginEmail(resetEmail.trim());
      }
    } catch (error: any) {
      const errorMessage = error.response?.error || error.message || "Failed to reset PIN. Please try again.";
      if (errorMessage.includes("OTP")) {
        setErrors((prev) => ({ ...prev, otp: errorMessage }));
      } else {
        setErrors((prev) => ({ ...prev, newPin: errorMessage }));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Welcome to Trippo</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "login" | "create")} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="create">Create Account</TabsTrigger>
          </TabsList>

          {/* Login Tab */}
          <TabsContent value="login" className="space-y-4 mt-4">
            {!showForgotPin ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="login-email" className="flex items-center gap-2">
                    <Mail size={16} />
                    Email
                  </Label>
                  <Input
                    id="login-email"
                    type="email"
                    value={loginEmail}
                    onChange={(e) => {
                      setLoginEmail(e.target.value);
                      setErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    placeholder="Enter your email"
                    className={errors.email ? "border-red-500" : ""}
                    required
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
                    className={
                      loginPin.length === 4 && !errors.loginPin
                        ? "border-green-500 ring-2 ring-green-500/20 focus:ring-green-500/40"
                        : errors.loginPin && loginPin.length !== 4
                        ? "border-red-500 ring-2 ring-red-500/20 focus:ring-red-500/40"
                        : ""
                    }
                    disabled={isLoading}
                  />
                  {errors.loginPin && (errors.loginPin !== "PIN must be 4 digits" || loginPin.length !== 4) && (
                    <p className="text-sm text-red-500">{errors.loginPin}</p>
                  )}
                </div>
                <Button
                  onClick={handleLogin}
                  className="w-full bg-blue-600 text-white hover:bg-blue-700"
                  disabled={loginPin.length !== 4 || isLoading}
                >
                  {isLoading ? "Signing in..." : "Sign In"}
                </Button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPin(true);
                      setResetEmail(loginEmail);
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700 underline"
                  >
                    Forgot PIN?
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Forgot PIN Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Reset Your PIN</h3>
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotPin(false);
                        setResetEmail("");
                        setOtp("");
                        setNewPin("");
                        setConfirmNewPin("");
                        setOtpSent(false);
                        setErrors({});
                      }}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Back to Login
                    </button>
                  </div>

              {!otpSent ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="reset-email" className="flex items-center gap-2">
                      <Mail size={16} />
                      Email Address
                    </Label>
                    <Input
                      id="reset-email"
                      type="email"
                      value={resetEmail}
                      onChange={(e) => {
                        setResetEmail(e.target.value);
                        setErrors((prev) => ({ ...prev, resetEmail: undefined }));
                      }}
                      placeholder="Enter your email"
                      className={errors.resetEmail ? "border-red-500" : ""}
                      onKeyPress={(e) => handleKeyPress(e, handleSendOTP)}
                    />
                    {errors.resetEmail && (
                      <p className="text-sm text-red-500">{errors.resetEmail}</p>
                    )}
                  </div>
                  <Button
                    onClick={handleSendOTP}
                    className="w-full bg-blue-600 text-white hover:bg-blue-700"
                    disabled={isLoading || !resetEmail.trim()}
                  >
                    {isLoading ? "Sending..." : "Send OTP"}
                  </Button>
                </>
              ) : (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-blue-800">
                      An OTP has been sent to <strong>{resetEmail}</strong>. Please check your email and enter the 6-digit code below.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="otp" className="flex items-center gap-2">
                      <Lock size={16} />
                      Enter OTP (6 digits)
                    </Label>
                    <Input
                      id="otp"
                      ref={otpRef}
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => {
                        const numericValue = e.target.value.replace(/\D/g, "").slice(0, 6);
                        setOtp(numericValue);
                        setErrors((prev) => ({ ...prev, otp: undefined }));
                      }}
                      placeholder="Enter 6-digit OTP"
                      className={errors.otp ? "border-red-500" : ""}
                    />
                    {errors.otp && (
                      <p className="text-sm text-red-500">{errors.otp}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-pin" className="flex items-center gap-2">
                      <Lock size={16} />
                      New PIN (4 digits)
                    </Label>
                    <Input
                      id="new-pin"
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      value={newPin}
                      onChange={(e) => {
                        const numericValue = e.target.value.replace(/\D/g, "").slice(0, 4);
                        setNewPin(numericValue);
                        setErrors((prev) => ({ ...prev, newPin: undefined }));
                      }}
                      placeholder="Enter new 4-digit PIN"
                      className={errors.newPin ? "border-red-500" : ""}
                    />
                    {errors.newPin && (
                      <p className="text-sm text-red-500">{errors.newPin}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-new-pin" className="flex items-center gap-2">
                      <Lock size={16} />
                      Confirm New PIN
                    </Label>
                    <Input
                      id="confirm-new-pin"
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      value={confirmNewPin}
                      onChange={(e) => {
                        const numericValue = e.target.value.replace(/\D/g, "").slice(0, 4);
                        setConfirmNewPin(numericValue);
                        setErrors((prev) => ({ ...prev, confirmNewPin: undefined }));
                      }}
                      placeholder="Re-enter new PIN"
                      className={errors.confirmNewPin ? "border-red-500" : ""}
                      onKeyPress={(e) => handleKeyPress(e, handleResetPin)}
                    />
                    {errors.confirmNewPin && (
                      <p className="text-sm text-red-500">{errors.confirmNewPin}</p>
                    )}
                  </div>
                  <Button
                    onClick={handleResetPin}
                    className="w-full bg-green-600 text-white hover:bg-green-700"
                    disabled={isLoading || otp.length !== 6 || newPin.length !== 4 || confirmNewPin.length !== 4}
                  >
                    {isLoading ? "Resetting PIN..." : "Reset PIN"}
                  </Button>
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setOtpSent(false);
                        setOtp("");
                        setNewPin("");
                        setConfirmNewPin("");
                        setErrors({});
                      }}
                      className="text-sm text-blue-600 hover:text-blue-700 underline"
                    >
                      Resend OTP
                    </button>
                  </div>
                </>
              )}
                </div>
              </>
            )}
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
                Email
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
                required
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone size={16} />
                Phone Number
              </Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setErrors((prev) => ({ ...prev, phone: undefined }));
                }}
                placeholder="Enter your phone number"
                className={errors.phone ? "border-red-500" : ""}
                required
              />
              {errors.phone && (
                <p className="text-sm text-red-500">{errors.phone}</p>
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
              className="w-full bg-blue-600 text-white hover:bg-blue-700"
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
