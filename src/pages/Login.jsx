import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";
import { isFirebaseConfigured, loginWithPassword } from "../firebase.js";

export default function Login() {
  const { user, ready, configured } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!ready) {
    return (
      <main className="page">
        <p>Loading…</p>
      </main>
    );
  }
  if (user?.role === "owner") {
    return <Navigate to="/owner" replace />;
  }
  if (user?.role === "friends") {
    return <Navigate to="/friends" replace />;
  }

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await loginWithPassword(password);
    } catch {
      setError("That password didn’t match.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page page-login">
      <h1>Call Me</h1>
      <p className="lede">Enter the password you were given.</p>
      {!configured || !isFirebaseConfigured() ? (
        <p className="error">
          Firebase isn’t configured yet. Copy `.env.example` to `.env.local` after you create
          the Firebase project.
        </p>
      ) : null}
      <form onSubmit={onSubmit}>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setError("");
          }}
        />
        <button type="submit" disabled={!password || busy || !configured}>
          {busy ? "Logging in…" : "Log in"}
        </button>
        {error ? <p className="error">{error}</p> : null}
      </form>
    </main>
  );
}
