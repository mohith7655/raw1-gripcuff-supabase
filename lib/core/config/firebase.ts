import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyArvR9zogpBSK9zmQIFULUSuUbC8iTNvcA",
  authDomain: "wazy-6c4a9.firebaseapp.com",
  databaseURL: "https://wazy-6c4a9-default-rtdb.firebaseio.com",
  projectId: "wazy-6c4a9",
  storageBucket: "wazy-6c4a9.firebasestorage.app",
  messagingSenderId: "618804250165",
  appId: "1:618804250165:web:f9d7ba05cbfa969523137c"
};

let app: FirebaseApp;
let db: Firestore;
let storage: FirebaseStorage;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app, 'raw1');
  storage = getStorage(app);
} catch (error) {
  console.error('Firebase initialization error:', error);
}

// `app` is exported so useNotifications can call getMessaging(app)
export { app, db, storage };
export const isFirebaseConfigured = true;
