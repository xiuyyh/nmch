
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
  Loader2
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
      createdAt: serverTimestamp() 
    }, { merge: true })
    .then(() => {
      toast({ title: "Admin Activated", description: "You are now the System Admin." });
    });
  };

  const handleDeleteUser = async (userId: string) => {
    if (!firestore) return;
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

  // ALLOW ACCESS IF: User is Admin OR No Admins exist in the entire system
  const canAccess = isUserAdmin || !adminsExist;

  if (!canAccess) {
    return (
      <AppShell>
        <div className="flex flex-col h-[60vh] w-full items-center justify-center text-center space-y-4">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
            <ShieldAlert className="w-8 h-8 text-destructive" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-headline font-bold uppercase tracking-tight">Access Restricted</h2>
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
            <div className="flex flex-col items-end gap-2">
              <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-500/10">NO ADMIN DETECTED</Badge>
              <Button onClick={handleBootstrapAdmin} className="bg-amber-600 hover:bg-amber-700 gap-2">
                <Lock className="w-4 h-4" /> Bootstrap First Admin
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Staff</span>
              <CardTitle className="text-3xl font-headline">{users?.length || 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Admins</span>
              <CardTitle className="text-3xl font-headline text-primary">
                {users?.filter(u => u.role === 'admin').length || 0}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">System Status</span>
              <CardTitle className="text-sm font-headline flex items-center gap-2">
                <CheckCircle2 className={`w-4 h-4 ${adminsExist ? 'text-emerald-500' : 'text-amber-500'}`} /> 
                {adminsExist ? 'SECURE & ACTIVE' : 'SECURITY UNCONFIGURED'}
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
                {users?.map((u) => (
                  <TableRow key={u.id} className="border-white/5 hover:bg-white/[0.02] transition-colors">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-white">{u.displayName || "Unknown Staff"}</span>
                        <span className="text-xs text-muted-foreground">{u.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select 
                        value={u.role} 
                        onValueChange={(val: UserRole) => handleUpdateRole(u.id, val)}
                        disabled={processingId === u.id || (u.role === 'admin' && isSelf(u.id) && users.filter(a => a.role === 'admin').length === 1)}
                      >
                        <SelectTrigger className="w-40 bg-white/5 border-white/10 h-10 text-xs font-bold uppercase">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="glass-card border-white/10">
                          {ROLES.map(role => (
                            <SelectItem key={role.value} value={role.value} className="text-xs font-bold uppercase">
                              {role.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-amber-500 uppercase tracking-widest">Security Protocol</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Staff roles strictly define what departments are visible in the sidebar. Admins have oversight across all departments and can manage these permissions.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
