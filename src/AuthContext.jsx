import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { isFirebaseConfigured, logout, subscribeToAuth } from "./firebase.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    return subscribeToAuth(setUser);
  }, []);

  const value = useMemo(
    () => ({
      user,
      ready: user !== undefined,
      configured: isFirebaseConfigured(),
      logout,
    }),
    [user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return value;
}
