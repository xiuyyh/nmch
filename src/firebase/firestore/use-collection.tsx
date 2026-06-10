'use client';

import { useState, useEffect } from 'react';
import { 
  Query, 
  onSnapshot, 
  QuerySnapshot, 
  DocumentData,
  FirestoreError 
} from 'firebase/firestore';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';

export function useCollection<T = DocumentData>(query: Query<T> | null) {
  const [data, setData] = useState<(T & { id: string })[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  useEffect(() => {
    if (!query) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = onSnapshot(
      query,
      (snapshot: QuerySnapshot<T>) => {
        const items = snapshot.docs.map((doc) => ({
          ...doc.data({ serverTimestamps: 'estimate' }),
          id: doc.id,
        }));
        setData(items as (T & { id: string })[]);
        setLoading(false);
      },
      (serverError: FirestoreError) => {
        if (serverError.code === 'permission-denied') {
          const permissionError = new FirestorePermissionError({
            path: (query as any)._query?.path?.toString() || 'unknown',
            operation: 'list',
          });
          errorEmitter.emit('permission-error', permissionError);
        }
        setError(serverError);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [query]);

  return { data, loading, error };
}
