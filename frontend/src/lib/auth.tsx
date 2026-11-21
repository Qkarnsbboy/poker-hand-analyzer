// Login with Supabase, and who is logged in right now.
//
// Two ways in: "Continue with Google", or an email magic link (backup).
//
//   Guest:     no session. Hands live in this browser. Own hands get no analysis.
//   Logged in: a session with a token. Hands live in the database, through the backend.
//
// Supabase keeps the session in the browser and refreshes the token by itself.

import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

let client: SupabaseClient | null = null;

// Made on first use, so code that never logs in (like tests) does not need the keys.
export function supabase(): SupabaseClient {
  if (client === null) {
    client = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
  }
  return client;
}

// The current login token, or null for a guest. Plain function, so non-React code can use it.
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase().auth.getSession();
  return data.session?.access_token ?? null;
}

interface Auth {
  ready: boolean; // false until we know if someone is logged in
  userId: string | null; // null = guest
  email: string | null;
  menuOpen: boolean; // the profile menu (top right) is open
  setMenuOpen: (open: boolean) => void;
  sendMagicLink: (email: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    // Who is logged in now (also picks up the session from a magic-link click).
    supabase()
      .auth.getSession()
      .then(({ data }) => {
        setSession(data.session);
        setReady(true);
      });

    // Keep up to date: sign in, sign out, token refresh.
    const { data } = supabase().auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const sendMagicLink = async (email: string) => {
    const { error } = await supabase().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) throw error;
  };

  // Goes to Google's login page; Google sends the user back here, logged in.
  const signInWithGoogle = async () => {
    const { error } = await supabase().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase().auth.signOut();
    setMenuOpen(false);
  };

  const auth: Auth = {
    ready,
    userId: session?.user.id ?? null,
    email: session?.user.email ?? null,
    menuOpen,
    setMenuOpen,
    sendMagicLink,
    signInWithGoogle,
    signOut,
  };
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuth(): Auth {
  const auth = useContext(AuthContext);
  if (auth === null) throw new Error("useAuth must be used inside <AuthProvider>");
  return auth;
}
