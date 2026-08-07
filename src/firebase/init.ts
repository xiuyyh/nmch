
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, enableMultiTabIndexedDbPersistence } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { firebaseConfig } from './config';

let appInstance: any = null;
let firestoreInstance: any = null;
let authInstance: any = null;
let persistenceInitialized = false;

/**
 * Initializes Firebase and returns the core service instances.
 * This should be called on the client side.
 */
export function initializeFirebase() {
  if (!appInstance) {
    appInstance = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  }
  
  if (!firestoreInstance) {
    firestoreInstance = getFirestore(appInstance);
  }

  if (!authInstance) {
    authInstance = getAuth(appInstance);
  }

  // Enable offline persistence for Firestore exactly once
  if (typeof window !== 'undefined' && !persistenceInitialized) {
    persistenceInitialized = true;
    enableMultiTabIndexedDbPersistence(firestoreInstance).catch((err) => {
      if (err.code === 'failed-precondition') {
        // Multiple tabs open, persistence can only be enabled in one tab at a time.
        console.warn('Firestore persistence failed: Multiple tabs open.');
      } else if (err.code === 'unimplemented') {
        // The current browser does not support all of the features required to enable persistence
        console.warn('Firestore persistence failed: Browser not supported.');
      } else {
        console.error('Firestore persistence error:', err);
      }
    });
  }

  return { 
    firebaseApp: appInstance, 
    firestore: firestoreInstance, 
    auth: authInstance 
  };
}
