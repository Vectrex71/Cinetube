import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, Auth } from 'firebase/auth';
import { getFirestore, Firestore, collection, doc, setDoc, deleteDoc, onSnapshot, query, getDocFromServer, increment, serverTimestamp, updateDoc, orderBy, limit, getDoc } from 'firebase/firestore';
import firebaseConfigFile from '../firebase-applet-config.json';

const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigFile.projectId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfigFile.appId,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigFile.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigFile.authDomain,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || firebaseConfigFile.firestoreDatabaseId || "(default)",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigFile.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigFile.messagingSenderId,
};

const app = initializeApp(firebaseConfig);

let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

export function getAuthInstance(): Auth {
  if (!authInstance) {
    authInstance = getAuth(app);
  }
  return authInstance;
}

export function getDbInstance(): Firestore {
  if (!dbInstance) {
    const dbId = firebaseConfig.firestoreDatabaseId || "(default)";
    console.log("DEBUG: Initializing Firestore with DB ID:", dbId);
    dbInstance = getFirestore(app, dbId);
  }
  return dbInstance;
}

export const googleProvider = new GoogleAuthProvider();

export const signIn = () => signInWithPopup(getAuthInstance(), googleProvider);
export const logOut = () => signOut(getAuthInstance());

// Test connection
async function testConnection() {
  try {
    await getDocFromServer(doc(getDbInstance(), 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const auth = getAuthInstance();
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export { collection, doc, setDoc, deleteDoc, onSnapshot, query, increment, serverTimestamp, updateDoc, orderBy, limit, getDoc };
