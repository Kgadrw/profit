import { useState } from "react";
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
import { Building2, Coins, AlertTriangle, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Settings = () => {
  const { toast } = useToast();
  const [businessName, setBusinessName] = useState("My Trading Co.");
  const [ownerName, setOwnerName] = useState("John Trader");
  const [email, setEmail] = useState("john@tradingco.com");
  const [currency, setCurrency] = useState("usd");
  const [lowStockThreshold, setLowStockThreshold] = useState("10");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSaveBusinessInfo = () => {
    toast({
      title: "Settings Saved",
      description: "Business information has been updated.",
    });
  };

  const handleSavePreferences = () => {
    toast({
      title: "Preferences Saved",
      description: "Your preferences have been updated.",
    });
  };

  const handleChangePassword = () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "New password and confirmation do not match.",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Password Changed",
      description: "Your password has been successfully updated.",
    });
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <AppLayout title="Settings">
      <div className="max-w-2xl space-y-6">
        {/* Business Information */}
        <div className="form-card">
          <h3 className="section-title flex items-center gap-2">
            <Building2 size={20} />
            Business Information
          </h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Business Name</Label>
              <Input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="input-field"
              />
            </div>
            <div className="space-y-2">
              <Label>Owner Name</Label>
              <Input
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="input-field"
              />
            </div>
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
              />
            </div>
            <Button onClick={handleSaveBusinessInfo} className="btn-primary">
              Save Changes
            </Button>
          </div>
        </div>

        {/* Preferences */}
        <div className="form-card">
          <h3 className="section-title flex items-center gap-2">
            <Coins size={20} />
            Preferences
          </h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="input-field">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="usd">USD ($)</SelectItem>
                  <SelectItem value="eur">EUR (€)</SelectItem>
                  <SelectItem value="gbp">GBP (£)</SelectItem>
                  <SelectItem value="jpy">JPY (¥)</SelectItem>
                  <SelectItem value="inr">INR (₹)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <AlertTriangle size={14} />
                Low Stock Threshold
              </Label>
              <Input
                type="number"
                min="1"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
                className="input-field"
              />
              <p className="text-xs text-muted-foreground">
                Products with stock below this number will appear in low stock alerts.
              </p>
            </div>
            <Button onClick={handleSavePreferences} className="btn-primary">
              Save Preferences
            </Button>
          </div>
        </div>

        {/* Change Password */}
        <div className="form-card">
          <h3 className="section-title flex items-center gap-2">
            <Lock size={20} />
            Change Password
          </h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Current Password</Label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="input-field"
                placeholder="Enter current password"
              />
            </div>
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input-field"
                placeholder="Enter new password"
              />
            </div>
            <div className="space-y-2">
              <Label>Confirm New Password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-field"
                placeholder="Confirm new password"
              />
            </div>
            <Button onClick={handleChangePassword} className="btn-primary">
              Change Password
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Settings;
