
"use client";

import React, { useState, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Wrench, 
  Plus, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  User, 
  Building2,
  Send,
  Loader2,
  Trash2,
  LayoutList
} from "lucide-react";
import { useCollection, useFirestore, useUser, useDoc } from "@/firebase";
import { collection, query, orderBy, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, limit, where, getDoc } from "firebase/firestore";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { cn, formatNigeriaTime } from "@/lib/utils";
import { sendTelegramNotification } from "@/lib/notifications";

export default function MaintenanceHubPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // User Profile for Role Check
  const userRef = useMemo(() => {
    if (!firestore || !user) return null;
    return doc(firestore, "users", user.uid);
  }, [firestore, user]);
  const { data: userRecord } = useDoc(userRef);
  const isAdmin = userRecord?.role === "admin";

  // Fetch Maintenance Reports
  const reportsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "maintenanceReports"), orderBy("timestamp", "desc"), limit(50));
  }, [firestore]);
  const { data: reports, loading } = useCollection(reportsQuery);

  const apartmentsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "apartments"), orderBy("name"));
  }, [firestore]);
  const { data: apartments } = useCollection(apartmentsQuery);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user || isSubmitting) return;

    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const apartmentName = formData.get("apartmentName") as string;
    const roomNumber = formData.get("roomNumber") as string;
    const description = formData.get("description") as string;
    const staffName = user.displayName || user.email;

    const reportData = {
      apartmentName,
      roomNumber: roomNumber || "General",
      description,
      reportedBy: staffName,
      status: "Pending",
      timestamp: serverTimestamp(),
      lastNotifiedAt: serverTimestamp()
    };

    try {
      await addDoc(collection(firestore, "maintenanceReports"), reportData);
      
      // Initial Telegram Notification
      const telegramMsg = `🛠️ *NEW MAINTENANCE REPORT*\n\n*Location:* ${apartmentName} (${roomNumber || 'General'})\n*Issue:* ${description}\n*Reported By:* ${staffName}\n\n_Status: Awaiting Resolution_`;
      sendTelegramNotification(firestore, telegramMsg);

      toast({ title: "Issue Reported", description: "Maintenance team has been notified via Telegram." });
      (e.target as HTMLFormElement).reset();
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to submit report." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolve = async (reportId: string) => {
    if (!firestore || !isAdmin) return;
    setProcessingId(reportId);

    const report = reports?.find(r => r.id === reportId);
    if (!report) return;

    try {
      await updateDoc(doc(firestore, "maintenanceReports", reportId), {
        status: "Resolved",
        resolvedAt: serverTimestamp(),
        resolvedBy: user?.displayName || user?.email
      });

      // Telegram Notification
      const telegramMsg = `✅ *ISSUE RESOLVED*\n\n*Location:* ${report.apartmentName}\n*Issue:* ${report.description}\n*Resolved By:* ${user?.displayName || user?.email}`;
      sendTelegramNotification(firestore, telegramMsg);

      toast({ title: "Issue Resolved", description: "Maintenance item marked as completed." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Status update failed." });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = (id: string) => {
    if (!firestore || !isAdmin) return;
    deleteDoc(doc(firestore, "maintenanceReports", id)).then(() => {
      toast({ title: "Record Deleted", description: "Maintenance log removed." });
    });
  };

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-headline font-bold uppercase tracking-tight text-white flex items-center gap-3">
              <Wrench className="w-8 h-8 text-primary" /> Maintenance Hub
            </h1>
            <p className="text-muted-foreground mt-1">Report facility issues and track repair status.</p>
          </div>
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-6 py-2 rounded-2xl">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Active Issues</span>
            <span className="text-xl font-headline font-bold text-amber-500">
              {reports?.filter(r => r.status === 'Pending').length || 0}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 sm:gap-10">
          <div className="lg:col-span-1">
            <Card className="glass-card sticky top-28">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 uppercase tracking-tight">
                  <Plus className="text-primary w-5 h-5" /> Report New Issue
                </CardTitle>
              </CardHeader>
              <form onSubmit={handleSubmit}>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Location (Apartment/Unit)</Label>
                    <Input name="apartmentName" list="apartments" required placeholder="e.g. Flat 1, Kitchen" className="bg-white/5 border-white/10 h-11" />
                    <datalist id="apartments">
                      {apartments?.map(a => <option key={a.id} value={a.name} />)}
                    </datalist>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Specific Room (Optional)</Label>
                    <Input name="roomNumber" placeholder="e.g. Master Bedroom" className="bg-white/5 border-white/10 h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Detailed Description</Label>
                    <Textarea name="description" required placeholder="Describe the fault..." className="bg-white/5 border-white/10 min-h-[120px]" />
                  </div>
                </CardContent>
                <CardFooter className="pt-2 pb-8">
                  <Button type="submit" disabled={isSubmitting} className="w-full h-14 bg-primary text-primary-foreground font-bold shadow-xl rounded-xl uppercase tracking-widest">
                    {isSubmitting ? <Loader2 className="animate-spin" /> : <><Send className="w-4 h-4 mr-2" /> Broadcast Alert</>}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center gap-2 px-2">
              <LayoutList className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-white">Facility Status Log</h2>
            </div>

            {loading ? (
              <div className="py-20 text-center animate-pulse text-muted-foreground font-bold uppercase tracking-widest text-xs">Scanning Grid...</div>
            ) : reports?.length === 0 ? (
              <div className="py-32 text-center flex flex-col items-center justify-center border border-dashed border-white/10 rounded-3xl opacity-40">
                <CheckCircle2 className="w-16 h-16 mb-4" />
                <p className="font-bold uppercase tracking-widest text-sm">Everything is functional</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {reports?.map((report) => {
                  const isPending = report.status === "Pending";
                  return (
                    <Card key={report.id} className={cn(
                      "glass-card border-l-4 transition-all duration-300",
                      isPending ? "border-l-amber-500 shadow-lg" : "border-l-emerald-500 opacity-60"
                    )}>
                      <div className="p-5 sm:p-6 flex flex-col sm:flex-row justify-between gap-6">
                        <div className="space-y-4 flex-1">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center",
                                isPending ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500"
                              )}>
                                <AlertCircle className="w-5 h-5" />
                              </div>
                              <div>
                                <h3 className="font-bold text-white uppercase text-sm">
                                  {report.apartmentName} {report.roomNumber !== 'General' && `— ${report.roomNumber}`}
                                </h3>
                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest flex items-center gap-2">
                                  <Clock className="w-3 h-3" /> {formatNigeriaTime(report.timestamp?.toDate())}
                                </p>
                              </div>
                            </div>
                            <Badge variant="outline" className={cn(
                              "text-[8px] uppercase px-2 h-5 border-none",
                              isPending ? "bg-amber-500/20 text-amber-400" : "bg-emerald-500/20 text-emerald-400"
                            )}>
                              {report.status}
                            </Badge>
                          </div>

                          <div className="bg-white/5 border border-white/5 rounded-xl p-4">
                            <p className="text-sm text-white/90 leading-relaxed font-medium">
                              {report.description}
                            </p>
                          </div>

                          <div className="flex items-center justify-between pt-2">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase">
                              <User className="w-3.5 h-3.5" /> Reported By: {report.reportedBy}
                            </div>
                            {report.resolvedBy && (
                              <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-500 uppercase">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Resolved By: {report.resolvedBy}
                              </div>
                            )}
                          </div>
                        </div>

                        {isAdmin && isPending && (
                          <div className="flex flex-col gap-2 shrink-0 pt-2 sm:pt-0 sm:justify-center">
                            <Button 
                              onClick={() => handleResolve(report.id)}
                              disabled={processingId === report.id}
                              className="h-12 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg uppercase tracking-widest text-[10px]"
                            >
                              {processingId === report.id ? <Loader2 className="animate-spin" /> : "Mark Resolved"}
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleDelete(report.id)}
                              className="h-12 w-12 text-muted-foreground hover:text-destructive self-center"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
