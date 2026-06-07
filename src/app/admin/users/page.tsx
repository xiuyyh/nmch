"use client";

import React, { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { UserRole } from "@/components/auth/RoleGuard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Users, 
  UserCog, 
  Trash2, 
  AlertCircle,
  CheckCircle2,
  Lock,
  ShieldAlert,
  Loader2,
  UserPlus,
  ShieldCheck
} from "lucide-react";
import { useCollection, useFirestore, useUser, useDoc } from "@/firebase";
import { collection, query, orderBy, doc, updateDoc, deleteDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const ROOT_ADMIN_EMAIL = "eahunanya116@gmail.com";

const ROLES: { value: UserRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "bar", label: "Bar Staff" },
  { value: "kitchen", label: "Kitchen Staff" },
  { value: "store", label: "Store Manager" },
  { value: "front_desk", label: "Front Desk" },
  { value: "housekeeper", label: "Housekeeper" },
];

export default function UserManagementPage() {
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const { toast } = useToast();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const usersQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "users"), orderBy("email"));
  }, [firestore]);

  const { data: users, loading } = useCollection(usersQuery);

  // Stealth Filter: Remove Root Admin from the directory
  const displayUsers = useMemo(() => {
    if (!users) return [];
    return users.filter(u => u.email !== ROOT_ADMIN_EMAIL);
  }, [users]);

  const currentUserRef = useMemo(() => {
    if (!firestore || !currentUser) return null;
    return doc(firestore, 'users', currentUser.uid);
  }, [firestore, currentUser]);

  const { data: currentUserRecord, loading: recordLoading } = useDoc(currentUserRef);

  const adminsExist = useMemo(() => {
    return users?.some(u => u.role === 'admin');
  }, [users]);

  const isUserAdmin = currentUserRecord?.role === 'admin';

  const handleUpdateRole = async (userId: string, newRole: UserRole) => {
    if (!firestore || !currentUser) return;
    
    // Safety check just in case
    const targetUser = users?.find(u => u.id === userId);
    if (targetUser?.email === ROOT_ADMIN_EMAIL) {
      toast({ variant: "destructive", title: "Action Forbidden", description: "Root Admin role cannot be modified." });
      return;
    }

    setProcessingId(userId);

    const userRef = doc(firestore, "users", userId);
    updateDoc(userRef, { role: newRole })
      .then(() => {
        toast({
          title: "Role Updated",
          description: `User permissions changed to ${newRole.toUpperCase()}.`,
        });
      })
      .catch(() => {
        toast({
          variant: "destructive",
          title: "Permission Denied",
          description: "You do not have authorization to change roles.",
        });
      })
      .finally(() => setProcessingId(null));
  };

  const handleBootstrapAdmin = async () => {
    if (!firestore || !currentUser) return;
    const ref = doc(firestore, 'users', currentUser.uid);
    setDoc(ref, { 
      email: currentUser.email,
      displayName: currentUser.displayName,
      role: 'admin',
      lastModified: serverTimestamp()
    }, { merge: true })
    .then(() => {
      toast({ title: "Admin Activated", description: "You are now the System Admin." });
    });
  };

  const handleDeleteUser = async (userId: string) => {
    if (!firestore) return;
    
    const targetUser = users?.find(u => u.id === userId);
    if (targetUser?.email === ROOT_ADMIN_EMAIL) {
      toast({ variant: "destructive", title: "Action Forbidden", description: "Root Admin cannot be deleted." });
      return;
    }

    const userRef = doc(firestore, "users", userId);
    deleteDoc(userRef).then(() => {
      toast({ title: "User Removed", description: "Account link deleted from database." });
    });
  };

  const isSelf = (userId: string) => currentUser?.uid === userId;

  if (loading || recordLoading) {
    return (
      <AppShell>
        <div className="flex h-[60vh] w-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  const canAccess = isUserAdmin || !adminsExist;

  if (!canAccess) {
    return (
      <AppShell>
        <div className="flex flex-col h-[60vh] w-full items-center justify-center text-center space-y-4">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
            <ShieldAlert className="w-8 h-8 text-destructive" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-headline font-bold uppercase tracking-tight text-white">Access Restricted</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Only authorized Administrators can manage staff roles.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-8 max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-headline font-bold uppercase tracking-tight text-white flex items-center gap-3">
              <Users className="w-8 h-8 text-primary" /> User Management
            </h1>
            <p className="text-muted-foreground mt-1">Control staff access levels and department assignments.</p>
          </div>
          
          {!adminsExist && (
            <div className="flex flex-col items-end gap-2 animate-pulse">
              <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-500/10">SECURITY UNCONFIGURED</Badge>
              <Button onClick={handleBootstrapAdmin} className="bg-amber-600 hover:bg-amber-700 gap-2 font-bold shadow-xl">
                <Lock className="w-4 h-4" /> Bootstrap First Admin
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Visible Staff</span>
              <CardTitle className="text-3xl font-headline">{displayUsers.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Active Admins</span>
              <CardTitle className="text-3xl font-headline text-primary">
                {displayUsers.filter(u => u.role === 'admin').length || 0}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">System Status</span>
              <CardTitle className="text-sm font-headline flex items-center gap-2">
                <CheckCircle2 className={`w-4 h-4 ${adminsExist ? 'text-emerald-500' : 'text-amber-500'}`} /> 
                {adminsExist ? 'SECURE & ACTIVE' : 'OPEN - ACTION REQUIRED'}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card className="glass-card overflow-hidden">
          <CardHeader className="border-b border-white/5">
            <CardTitle className="text-xl font-headline flex items-center gap-2">
              <UserCog className="w-5 h-5 text-primary" /> Staff Directory
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-white/[0.02]">
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest">Name / Email</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest">Departmental Role</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest">Joined</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayUsers.map((u) => (
                  <TableRow key={u.id} className="border-white/5 hover:bg-white/[0.02] transition-colors">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-white">{u.displayName || "Unknown Staff"}</span>
                        <span className="text-xs text-muted-foreground">{u.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Select 
                          value={u.role || ""} 
                          onValueChange={(val: UserRole) => handleUpdateRole(u.id, val)}
                          disabled={processingId === u.id || (u.role === 'admin' && isSelf(u.id) && displayUsers.filter(a => a.role === 'admin').length === 0)}
                        >
                          <SelectTrigger className={cn(
                            "w-44 bg-white/5 border-white/10 h-10 text-xs font-bold uppercase",
                            !u.role && "text-amber-500 border-amber-500/30"
                          )}>
                            <SelectValue placeholder="UNASSIGNED STAFF" />
                          </SelectTrigger>
                          <SelectContent className="glass-card border-white/10">
                            {ROLES.map(role => (
                              <SelectItem key={role.value} value={role.value} className="text-xs font-bold uppercase">
                                {role.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {!u.role && (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[8px] animate-pulse">
                            PENDING ASSIGNMENT
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground uppercase font-bold">
                        {u.createdAt?.toDate ? format(u.createdAt.toDate(), "MMM dd, yyyy") : "N/A"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {!isSelf(u.id) && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="hover:text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="glass-card border-white/10">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete User Access?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will remove {u.displayName}'s departmental role from the NMCH system. They will no longer be able to access restricted sections.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="bg-white/5 border-white/10">Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteUser(u.id)} className="bg-destructive text-destructive-foreground">
                                Revoke Access
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                      {isSelf(u.id) && (
                        <Badge variant="outline" className="border-primary/20 text-primary uppercase text-[8px] font-bold">
                          You
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-4">
          <ShieldCheck className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-amber-500 uppercase tracking-widest">Root Protection Active</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The Root Admin account is hidden and immutable. All other staff roles are strictly visible and manageable.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}