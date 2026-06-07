
'use client';

import { useMemo } from 'react';
import { useUser, useDoc, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';

export type UserRole = 'admin' | 'bar' | 'kitchen' | 'store' | 'front_desk' | 'housekeeper';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}

export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const { user, loading: authLoading } = useUser();
  const firestore = useFirestore();

  const userRef = useMemo(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userRecord, loading: recordLoading } = useDoc(userRef);

  if (authLoading || recordLoading) {
    return (
      <AppShell>
        <div className="flex h-[60vh] w-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  const role = userRecord?.role as UserRole;

  if (role !== 'admin' && !allowedRoles.includes(role)) {
    return (
      <AppShell>
        <div className="flex flex-col h-[60vh] w-full items-center justify-center text-center space-y-4">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
            <ShieldAlert className="w-8 h-8 text-destructive" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-headline font-bold uppercase tracking-tight">Access Restricted</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Your account (Role: <span className="text-white font-bold uppercase">{role}</span>) does not have permission to access this department.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  return <>{children}</>;
}
