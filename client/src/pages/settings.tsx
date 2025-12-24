import { Layout } from "@/components/layout";
import { 
  User, 
  Bell, 
  Palette,
  Database,
  Cloud,
  Key,
  Save,
  Check,
  Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";

interface UserSettings {
  profile: {
    firstName: string;
    lastName: string;
    email: string;
    firm: string;
    barNumber: string;
  };
  notifications: {
    deadlineReminders: boolean;
    documentUpdates: boolean;
    aiComplete: boolean;
    collabUpdates: boolean;
    reminderTiming: string;
  };
  appearance: {
    theme: string;
    compactMode: boolean;
    animations: boolean;
  };
}

const defaultSettings: UserSettings = {
  profile: {
    firstName: "",
    lastName: "",
    email: "",
    firm: "",
    barNumber: "",
  },
  notifications: {
    deadlineReminders: true,
    documentUpdates: true,
    aiComplete: true,
    collabUpdates: false,
    reminderTiming: "3days",
  },
  appearance: {
    theme: "system",
    compactMode: false,
    animations: true,
  },
};

const SETTINGS_KEY = "casebuddy_settings";

function loadSettings(): UserSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      return { ...defaultSettings, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error("Failed to load settings:", e);
  }
  return defaultSettings;
}

function saveSettings(settings: UserSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error("Failed to save settings:", e);
  }
}

export default function SettingsPage() {
  const { toast } = useToast();
  const { logout } = useAuth();
  const [, setLocation] = useLocation();
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  const updateProfile = (field: keyof UserSettings["profile"], value: string) => {
    setSettings((prev) => ({
      ...prev,
      profile: { ...prev.profile, [field]: value },
    }));
  };

  const updateNotifications = (field: keyof UserSettings["notifications"], value: boolean | string) => {
    setSettings((prev) => ({
      ...prev,
      notifications: { ...prev.notifications, [field]: value },
    }));
  };

  const updateAppearance = (field: keyof UserSettings["appearance"], value: boolean | string) => {
    setSettings((prev) => ({
      ...prev,
      appearance: { ...prev.appearance, [field]: value },
    }));
  };

  const handleSave = () => {
    saveSettings(settings);
    setSaved(true);
    toast({ title: "Settings saved successfully" });
    setTimeout(() => setSaved(false), 2000);
  };

  const handlePasswordChange = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentPassword || !newPassword) {
      toast({
        title: "Missing fields",
        description: "Please enter your current and new password.",
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords do not match",
        description: "Confirm your new password before saving.",
        variant: "destructive",
      });
      return;
    }

    setUpdatingPassword(true);
    try {
      await apiRequest("POST", "/api/auth/change-password", {
        currentPassword,
        newPassword,
      });
      toast({
        title: "Password updated",
        description: "Please sign in again with your new password.",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await logout();
      setLocation("/login");
    } catch (error: any) {
      const message =
        typeof error?.message === "string"
          ? error.message.replace(/^\d+:\s*/, "")
          : "Password update failed.";
      toast({
        title: "Password update failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setUpdatingPassword(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif font-bold text-primary" data-testid="text-page-title">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your account and application preferences</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full md:w-auto md:inline-grid grid-cols-2 md:grid-cols-4 gap-1">
            <TabsTrigger value="profile" className="gap-2">
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="w-4 h-4" />
              <span className="hidden sm:inline">Notifications</span>
            </TabsTrigger>
            <TabsTrigger value="appearance" className="gap-2">
              <Palette className="w-4 h-4" />
              <span className="hidden sm:inline">Appearance</span>
            </TabsTrigger>
            <TabsTrigger value="integrations" className="gap-2">
              <Cloud className="w-4 h-4" />
              <span className="hidden sm:inline">Integrations</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your personal information and contact details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      placeholder="John"
                      value={settings.profile.firstName}
                      onChange={(e) => updateProfile("firstName", e.target.value)}
                      data-testid="input-first-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      placeholder="Doe"
                      value={settings.profile.lastName}
                      onChange={(e) => updateProfile("lastName", e.target.value)}
                      data-testid="input-last-name"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john.doe@lawfirm.com"
                    value={settings.profile.email}
                    onChange={(e) => updateProfile("email", e.target.value)}
                    data-testid="input-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="firm">Law Firm / Organization</Label>
                  <Input
                    id="firm"
                    placeholder="Smith & Associates LLP"
                    value={settings.profile.firm}
                    onChange={(e) => updateProfile("firm", e.target.value)}
                    data-testid="input-firm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="barNumber">Bar Number</Label>
                  <Input
                    id="barNumber"
                    placeholder="123456"
                    value={settings.profile.barNumber}
                    onChange={(e) => updateProfile("barNumber", e.target.value)}
                    data-testid="input-bar-number"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Security
                </CardTitle>
                <CardDescription>Manage your account security settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Current Password</Label>
                    <Input
                      id="current-password"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      autoComplete="current-password"
                      data-testid="input-current-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      autoComplete="new-password"
                      data-testid="input-new-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      autoComplete="new-password"
                      data-testid="input-confirm-password"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" variant="outline" disabled={updatingPassword} data-testid="button-change-password">
                      {updatingPassword ? "Updating..." : "Change Password"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Email Notifications</CardTitle>
                <CardDescription>Choose what notifications you want to receive</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Deadline Reminders</Label>
                    <p className="text-sm text-muted-foreground">Get notified before important deadlines</p>
                  </div>
                  <Switch
                    checked={settings.notifications.deadlineReminders}
                    onCheckedChange={(checked) => updateNotifications("deadlineReminders", checked)}
                    data-testid="switch-deadline-reminders"
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Document Updates</Label>
                    <p className="text-sm text-muted-foreground">Notifications when documents are processed</p>
                  </div>
                  <Switch
                    checked={settings.notifications.documentUpdates}
                    onCheckedChange={(checked) => updateNotifications("documentUpdates", checked)}
                    data-testid="switch-document-updates"
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>AI Analysis Complete</Label>
                    <p className="text-sm text-muted-foreground">Get notified when AI analysis is done</p>
                  </div>
                  <Switch
                    checked={settings.notifications.aiComplete}
                    onCheckedChange={(checked) => updateNotifications("aiComplete", checked)}
                    data-testid="switch-ai-complete"
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Collaboration Updates</Label>
                    <p className="text-sm text-muted-foreground">When team members make changes to cases</p>
                  </div>
                  <Switch
                    checked={settings.notifications.collabUpdates}
                    onCheckedChange={(checked) => updateNotifications("collabUpdates", checked)}
                    data-testid="switch-collab-updates"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Reminder Timing</CardTitle>
                <CardDescription>When to send deadline reminders</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label>Send reminders</Label>
                  <Select
                    value={settings.notifications.reminderTiming}
                    onValueChange={(value) => updateNotifications("reminderTiming", value)}
                  >
                    <SelectTrigger data-testid="select-reminder-timing">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1day">1 day before</SelectItem>
                      <SelectItem value="3days">3 days before</SelectItem>
                      <SelectItem value="1week">1 week before</SelectItem>
                      <SelectItem value="2weeks">2 weeks before</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Theme</CardTitle>
                <CardDescription>Customize the appearance of the application</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Color Theme</Label>
                  <Select
                    value={settings.appearance.theme}
                    onValueChange={(value) => updateAppearance("theme", value)}
                  >
                    <SelectTrigger data-testid="select-theme">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Compact Mode</Label>
                    <p className="text-sm text-muted-foreground">Reduce spacing for more content on screen</p>
                  </div>
                  <Switch
                    checked={settings.appearance.compactMode}
                    onCheckedChange={(checked) => updateAppearance("compactMode", checked)}
                    data-testid="switch-compact-mode"
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Show Animations</Label>
                    <p className="text-sm text-muted-foreground">Enable interface animations and transitions</p>
                  </div>
                  <Switch
                    checked={settings.appearance.animations}
                    onCheckedChange={(checked) => updateAppearance("animations", checked)}
                    data-testid="switch-animations"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cloud className="w-5 h-5" />
                  Google Drive
                </CardTitle>
                <CardDescription>Connect your Google Drive for document syncing</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Cloud className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">Google Drive</p>
                      <p className="text-sm text-muted-foreground">Sync documents from your Drive folders</p>
                    </div>
                  </div>
                  <Button variant="outline" data-testid="button-connect-drive">Connect</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  Configured Services
                </CardTitle>
                <CardDescription>Status of integrated services</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-200">
                  <div>
                    <p className="font-medium text-green-800">Daily.co Video</p>
                    <p className="text-sm text-green-600">Video conferencing is configured</p>
                  </div>
                  <Check className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-200">
                  <div>
                    <p className="font-medium text-green-800">Google Gemini AI</p>
                    <p className="text-sm text-green-600">AI features are configured</p>
                  </div>
                  <Check className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-200">
                  <div>
                    <p className="font-medium text-green-800">PostgreSQL Database</p>
                    <p className="text-sm text-green-600">Database is connected</p>
                  </div>
                  <Check className="w-5 h-5 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Data Management
                </CardTitle>
                <CardDescription>Export or manage your data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Export All Data</p>
                    <p className="text-sm text-muted-foreground">Download all your cases and documents</p>
                  </div>
                  <Button variant="outline" data-testid="button-export-all">Export</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} className="gap-2" data-testid="button-save-settings">
            {saved ? (
              <>
                <Check className="w-4 h-4" />
                Saved
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
    </Layout>
  );
}
