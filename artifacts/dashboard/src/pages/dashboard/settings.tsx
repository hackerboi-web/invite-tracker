import { useGetGuildSettings, useUpdateGuildSettings } from "@workspace/api-client-react";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Settings({ params }: { params: { guildId: string } }) {
  const { guildId } = params;
  const { data: settings, isLoading } = useGetGuildSettings(guildId, { query: { enabled: !!guildId } });
  const updateSettings = useUpdateGuildSettings();
  const { toast } = useToast();

  const [formData, setFormData] = useState<any>({});
  const initialized = useRef(false);

  useEffect(() => {
    if (settings && !initialized.current) {
      setFormData(settings);
      initialized.current = true;
    }
  }, [settings]);

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    updateSettings.mutate({
      guildId,
      data: {
        joinMessage: formData.joinMessage,
        leaveMessage: formData.leaveMessage,
        joinChannelId: formData.joinChannelId,
        leaveChannelId: formData.leaveChannelId,
        fakeThreshold: Number(formData.fakeThreshold),
        trackFakeInvites: formData.trackFakeInvites,
        trackLeaves: formData.trackLeaves,
        embedColor: formData.embedColor
      }
    }, {
      onSuccess: () => {
        toast({ title: "Settings saved successfully" });
      },
      onError: () => {
        toast({ title: "Failed to save settings", variant: "destructive" });
      }
    });
  };

  if (isLoading || !settings) {
    return (
      <DashboardLayout guildId={guildId}>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout guildId={guildId}>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Server Settings</h1>
          <p className="text-muted-foreground mt-2">Configure how InviteTracker behaves.</p>
        </div>
        <Button onClick={handleSave} disabled={updateSettings.isPending}>
          {updateSettings.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Changes
        </Button>
      </div>

      <div className="space-y-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-white">Welcome Messages</CardTitle>
            <CardDescription>
              Variables: {"{user}"}, {"{username}"}, {"{server}"}, {"{inviter}"}, {"{inviterName}"}, {"{count}"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3">
              <Label htmlFor="joinChannel">Join Channel ID</Label>
              <Input 
                id="joinChannel" 
                value={formData.joinChannelId || ""} 
                onChange={(e) => handleChange("joinChannelId", e.target.value)}
                placeholder="e.g. 123456789012345678"
                className="bg-background border-border"
              />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="joinMessage">Join Message</Label>
              <Textarea 
                id="joinMessage" 
                value={formData.joinMessage || ""} 
                onChange={(e) => handleChange("joinMessage", e.target.value)}
                placeholder="Welcome {user} to {server}! Invited by {inviter} ({count} invites)."
                className="bg-background border-border min-h-[100px]"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-white">Leave Messages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3">
              <Label htmlFor="leaveChannel">Leave Channel ID</Label>
              <Input 
                id="leaveChannel" 
                value={formData.leaveChannelId || ""} 
                onChange={(e) => handleChange("leaveChannelId", e.target.value)}
                placeholder="e.g. 123456789012345678"
                className="bg-background border-border"
              />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="leaveMessage">Leave Message</Label>
              <Textarea 
                id="leaveMessage" 
                value={formData.leaveMessage || ""} 
                onChange={(e) => handleChange("leaveMessage", e.target.value)}
                placeholder="{username} left us. They were invited by {inviterName}."
                className="bg-background border-border min-h-[100px]"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-white">Security & Tracking</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-background">
              <div className="space-y-0.5">
                <Label className="text-white">Track Leaves</Label>
                <div className="text-sm text-muted-foreground">Subtract invites when invited members leave.</div>
              </div>
              <Switch 
                checked={formData.trackLeaves} 
                onCheckedChange={(c) => handleChange("trackLeaves", c)} 
              />
            </div>
            
            <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-background">
              <div className="space-y-0.5">
                <Label className="text-white">Fake Detection</Label>
                <div className="text-sm text-muted-foreground">Detect and flag alt accounts automatically.</div>
              </div>
              <Switch 
                checked={formData.trackFakeInvites} 
                onCheckedChange={(c) => handleChange("trackFakeInvites", c)} 
              />
            </div>

            <div className="grid gap-3 p-4 rounded-lg border border-border bg-background">
              <Label htmlFor="fakeThreshold" className="text-white">Account Age Threshold (Days)</Label>
              <div className="text-sm text-muted-foreground mb-2">Accounts newer than this will be marked as fake.</div>
              <Input 
                id="fakeThreshold" 
                type="number"
                value={formData.fakeThreshold || 0} 
                onChange={(e) => handleChange("fakeThreshold", e.target.value)}
                className="max-w-[200px] bg-card border-border"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
