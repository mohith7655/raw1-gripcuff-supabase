import { initializeApp, FirebaseApp, setLogLevel } from 'firebase/app';
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, Firestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getDatabase, Database } from 'firebase/database';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyArvR9zogpBSK9zmQIFULUSuUbC8iTNvcA",
  authDomain: "wazy-6c4a9.firebaseapp.com",
  databaseURL: "https://wazy-6c4a9-default-rtdb.firebaseio.com",
  projectId: "wazy-6c4a9",
  storageBucket: "wazy-6c4a9.firebasestorage.app",
  messagingSenderId: "618804250165",
  appId: "1:618804250165:web:f9d7ba05cbfa969523137c"
};

// Real config is now hardcoded
const hasRealConfig = true;

// Enable Firebase debug logging in the browser console
setLogLevel('debug');

// Initialize Firebase
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;
let rtdb: Database;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app, 'raw1'); // Use the 'raw1' named database
  storage = getStorage(app);
  rtdb = getDatabase(app);

  // Use emulator in development if no real config
  if (!hasRealConfig) {
    try {
      connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    } catch (e) {
      console.warn('Auth emulator already connected or not available');
    }
    try {
      connectFirestoreEmulator(db, 'localhost', 8080);
    } catch (e) {
      console.warn('Firestore emulator already connected or not available');
    }
  }
} catch (error) {
  console.error('Firebase initialization error:', error);
}

// `app` is exported so the useNotifications hook can call getMessaging(app)
export { app, auth, db, storage, rtdb };
export const isFirebaseConfigured = hasRealConfig;
