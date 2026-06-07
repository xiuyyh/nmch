'use client';

import { useEffect, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useUser, useDoc, useFirestore } from '@/firebase';
import { Loader2 } from 'lucide-react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

const ROOT_ADMIN_EMAIL = "eahunanya116@gmail.com";

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

  // Sync user record and enforce Root Admin status
  useEffect(() => {
    if (user && !recordLoading && firestore) {
      const isRoot = user.email === ROOT_ADMIN_EMAIL;
      
      // If root admin is missing or role is wrong, force update
      if (!userRecord || (isRoot && userRecord.role !== 'admin')) {
        const ref = doc(firestore, 'users', user.uid);
        const updateData: any = {
          email: user.email,
          displayName: user.displayName,
          createdAt: userRecord?.createdAt || serverTimestamp(),
          lastModified: serverTimestamp()
        };

        if (isRoot) {
          updateData.role = 'admin';
        }

        setDoc(ref, updateData, { merge: true });
      }
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