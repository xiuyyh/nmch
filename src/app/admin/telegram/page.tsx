
"use client";

import React, { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Send, Settings2, ShieldCheck, MessageSquare, Save, Loader2, AlertCircle, Clock } from "lucide-react";
import { useFirestore, useDoc } from "@/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

export default function TelegramConfigPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const configRef = React.useMemo(() => {
    if (!firestore) return null;
    return doc(firestore, "settings", "telegram");
  }, [firestore]);

  const { data: config, loading } = useDoc(configRef);

  const [formData, setFormData] = useState({
    botToken: "",
    chatId: "",
    enabled: false,
    maintenanceFreq: 5
  });

  useEffect(() => {
    if (config) {
      setFormData({
        botToken: config.botToken || "",
        chatId: config.chatId || "",
        enabled: config.enabled || false,
        maintenanceFreq: config.maintenanceFreq || 5
      });
    }
  }, [config]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await setDoc(doc(firestore, "settings", "telegram"), {
        ...formData,
        lastUpdated: serverTimestamp()
      }, { merge: true });
      toast({ title: "Config Saved", description: "Telegram notification settings updated." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to save settings." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTest = async () => {
    if (!formData.botToken || !formData.chatId) {
      toast({ variant: "destructive", title: "Missing Data", description: "Enter Token and Chat ID to test." });
      return;
    }

    setIsTesting(true);
    try {
      const url = `https://api.telegram.org/bot${formData.botToken}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: formData.chatId,
          text: "🚀 *NMCH SYSTEM TEST*\nTelegram notifications are now connected correctly.",
          parse_mode: 'Markdown',
        }),
      });

      if (response.ok) {
        toast({ title: "Test Successful", description: "Check your Telegram channel!" });
      } else {
        throw new Error("Failed to send");
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Test Failed", description: "Check your Token and Chat ID." });
    } finally {
      setIsTesting(false);
    }
  };

  if (loading) return <AppShell><div className="flex h-[60vh] items-center justify-center animate-pulse">Loading Config...</div></AppShell>;

  return (
    <RoleGuard allowedRoles={["admin"]}>
      <AppShell>
        <div className="max-w-3xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl font-headline font-bold uppercase tracking-tight text-white flex items-center gap-3">
              <MessageSquare className="w-8 h-8 text-primary" /> Telegram Broadcast
            </h1>
            <p className="text-muted-foreground mt-1">Configure automated activity logging to your management Telegram channel.</p>
          </div>

          <Card className="glass-card">
            <CardHeader className="border-b border-white/5">
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-primary" /> API Configuration
              </CardTitle>
            </CardHeader>
            <form onSubmit={handleSave}>
              <CardContent className="space-y-6 pt-6">
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-bold">Notifications Active</Label>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Enable or disable system-wide broadcasts</p>
                  </div>
                  <Switch 
                    checked={formData.enabled} 
                    onCheckedChange={(val) => setFormData({...formData, enabled: val})} 
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Bot API Token</Label>
                    <Input 
                      type="password"
                      placeholder="BotFather Token" 
                      value={formData.botToken}
                      onChange={(e) => setFormData({...formData, botToken: e.target.value})}
                      className="bg-white/5 border-white/10 h-12"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Chat ID</Label>
                    <Input 
                      placeholder="-100123456789" 
                      value={formData.chatId}
                      onChange={(e) => setFormData({...formData, chatId: e.target.value})}
                      className="bg-white/5 border-white/10 h-12"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    <Label className="text-sm font-bold">Maintenance Notification Interval</Label>
                  </div>
                  <div className="flex items-center gap-4">
                    <Input 
                      type="number"
                      min="1"
                      max="48"
                      value={formData.maintenanceFreq}
                      onChange={(e) => setFormData({...formData, maintenanceFreq: Number(e.target.value)})}
                      className="bg-white/5 border-white/10 h-12 w-24 text-center font-bold"
                    />
                    <span className="text-sm text-muted-foreground font-medium">Hours</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest leading-relaxed">
                    Unresolved maintenance issues will trigger a Telegram alert at this interval.
                  </p>
                </div>

                <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Ensure your bot has been added to the channel as an Administrator with "Send Messages" permission.
                  </p>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col sm:flex-row gap-3 bg-white/[0.01] border-t border-white/5 p-6">
                <Button 
                  type="submit" 
                  disabled={isSubmitting} 
                  className="w-full sm:flex-1 h-12 bg-primary text-primary-foreground font-bold shadow-lg"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Save Settings</>}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleTest}
                  disabled={isTesting}
                  className="w-full sm:w-auto h-12 border-white/10 font-bold px-8"
                >
                   {isTesting ? <Loader2 className="animate-spin" /> : <><Send className="w-4 h-4 mr-2" /> Test Connection</>}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </AppShell>
    </RoleGuard>
  );
}
