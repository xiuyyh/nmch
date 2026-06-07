
'use client';

import { useEffect, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useUser, useDoc, useFirestore } from '@/firebase';
import { Loader2 } from 'lucide-react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const pathname = usePathname();

  const userRef = useMemo(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userRecord, loading: recordLoading } = useDoc(userRef);

  const publicPaths = ['/login', '/signup'];

  useEffect(() => {
    if (!authLoading) {
      const isPublicPath = publicPaths.includes(pathname);
      if (!user && !isPublicPath) {
        router.push('/login');
      } else if (user && isPublicPath) {
        router.push('/');
      }
    }
  }, [user, authLoading, pathname, router]);

  // Sync user record if it doesn't exist
  useEffect(() => {
    if (user && !recordLoading && !userRecord && firestore) {
      const ref = doc(firestore, 'users', user.uid);
      setDoc(ref, {
        email: user.email,
        displayName: user.displayName,
        role: 'bar', // Default role for new signups
        createdAt: serverTimestamp()
      }, { merge: true });
    }
  }, [user, recordLoading, userRecord, firestore]);

  if (authLoading || (user && recordLoading)) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isPublicPath = publicPaths.includes(pathname);

  if (!user && !isPublicPath) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
