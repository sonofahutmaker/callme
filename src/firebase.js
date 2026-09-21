import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  runTransaction,
  setDoc,
} from "firebase/firestore";
import { emptyNames, emptyWeekData } from "./week.js";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const OWNER_EMAIL = import.meta.env.VITE_OWNER_EMAIL;
export const FRIENDS_EMAIL = import.meta.env.VITE_FRIENDS_EMAIL;

export function isFirebaseConfigured() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && OWNER_EMAIL && FRIENDS_EMAIL);
}

let app;
let auth;
let db;

function getApp() {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured");
  }
  if (!app) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  }
  return { auth, db };
}

export function getFirebaseAuth() {
  return getApp().auth;
}

export function getDb() {
  return getApp().db;
}

export function roleFromEmail(email) {
  if (email === OWNER_EMAIL) {
    return "owner";
  }
  if (email === FRIENDS_EMAIL) {
    return "friends";
  }
  return null;
}

export function subscribeToAuth(callback) {
  if (!isFirebaseConfigured()) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(getFirebaseAuth(), (user) => {
    if (!user) {
      callback(null);
      return;
    }
    callback({
      uid: user.uid,
      email: user.email,
      role: roleFromEmail(user.email),
    });
  });
}

export async function loginWithPassword(password) {
  const { auth } = getApp();
  try {
    return await signInWithEmailAndPassword(auth, OWNER_EMAIL, password);
  } catch (ownerError) {
    try {
      return await signInWithEmailAndPassword(auth, FRIENDS_EMAIL, password);
    } catch {
      throw ownerError;
    }
  }
}

export function logout() {
  if (!isFirebaseConfigured()) {
    return Promise.resolve();
  }
  return signOut(getFirebaseAuth());
}

function weekRef(weekId) {
  return doc(getDb(), "weeks", weekId);
}

function nameRef(weekId, day) {
  return doc(getDb(), "weeks", weekId, "private", day);
}

function namesCollection(weekId) {
  return collection(getDb(), "weeks", weekId, "private");
}

export async function ensureWeek(weekId) {
  const ref = weekRef(weekId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, emptyWeekData());
  }
}

export function subscribeToWeek(weekId, onData, onError) {
  const unsubWeek = onSnapshot(
    weekRef(weekId),
    (snap) => {
      onData({
        ...(snap.data() || emptyWeekData()),
        exists: snap.exists(),
      });
    },
    onError,
  );
  return unsubWeek;
}

export function subscribeToNames(weekId, onData, onError) {
  return onSnapshot(
    namesCollection(weekId),
    (snap) => {
      const names = emptyNames();
      snap.forEach((entry) => {
        names[entry.id] = entry.data().name || "";
      });
      onData(names);
    },
    onError,
  );
}

export async function saveAvailability(weekId, available, preferred) {
  const ref = weekRef(weekId);
  await runTransaction(getDb(), async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) {
      transaction.set(ref, { ...emptyWeekData(), available, preferred });
      return;
    }
    transaction.update(ref, { available, preferred });
  });
}

export async function signUpForDay(weekId, day, name) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Enter your name");
  }
  const publicRef = weekRef(weekId);
  const privateRef = nameRef(weekId, day);
  await runTransaction(getDb(), async (transaction) => {
    const publicSnap = await transaction.get(publicRef);
    const data = publicSnap.exists() ? publicSnap.data() : emptyWeekData();
    if (!data.available?.[day]) {
      throw new Error("That day is not available");
    }
    if (data.taken?.[day]) {
      throw new Error("That day is already taken");
    }
    if (!publicSnap.exists()) {
      transaction.set(publicRef, {
        ...emptyWeekData(),
        taken: { ...emptyWeekData().taken, [day]: true },
      });
    } else {
      transaction.update(publicRef, { [`taken.${day}`]: true });
    }
    transaction.set(privateRef, { name: trimmed });
  });
}

export async function cancelSignUp(weekId, day) {
  const publicRef = weekRef(weekId);
  const privateRef = nameRef(weekId, day);
  await runTransaction(getDb(), async (transaction) => {
    const publicSnap = await transaction.get(publicRef);
    if (!publicSnap.exists() || !publicSnap.data().taken?.[day]) {
      throw new Error("That signup no longer exists");
    }
    transaction.update(publicRef, { [`taken.${day}`]: false });
    transaction.delete(privateRef);
  });
}
