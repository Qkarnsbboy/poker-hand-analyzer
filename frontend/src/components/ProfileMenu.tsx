// The user icon, top right.
//   Guest:     "Guest" -> "Continue with Google", or email box -> "Send sign-in link".
//   Logged in: the first letter of the email -> email + "Sign out".

import { useEffect, useRef, useState } from "react";
import { useAuth } from "../lib/auth";

export function ProfileMenu() {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorText, setErrorText] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  // Close the menu when clicking anywhere outside it.
  useEffect(() => {
    if (!auth.menuOpen) return;
    const onClick = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) auth.setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [auth.menuOpen]);

  const send = async () => {
    setStatus("sending");
    try {
      await auth.sendMagicLink(email.trim());
      setStatus("sent");
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "Could not send the link.");
      setStatus("error");
    }
  };

  const isGuest = auth.userId === null;
  const initial = isGuest ? "" : (auth.email ?? "?")[0].toUpperCase();

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => auth.setMenuOpen(!auth.menuOpen)}
        className="h-full flex items-center gap-2 rounded-lg border border-nav-border bg-nav pl-1 pr-3 text-sm font-semibold text-nav-ink hover:opacity-85"
        title={isGuest ? "Sign in" : (auth.email ?? "")}
      >
        <span className="w-6 h-6 rounded-full bg-nav-ink text-nav flex items-center justify-center text-xs font-bold">
          {isGuest ? <PersonIcon /> : initial}
        </span>
        {isGuest ? "Guest" : "Account"}
      </button>

      {auth.menuOpen && (
        <div className="absolute right-0 mt-2 w-72 z-20 rounded-xl border border-line-strong bg-panel p-4 shadow-xl space-y-3">
          {isGuest ? (
            <>
              <div>
                <div className="font-bold">Sign in</div>
                <div className="text-xs text-ink-dim">Save hands to your account and get analysis. We email you a sign-in link.</div>
              </div>
              <button
                type="button"
                onClick={() => auth.signInWithGoogle().catch((e: Error) => {
                  setErrorText(e.message);
                  setStatus("error");
                })}
                className="w-full flex items-center justify-center gap-2 rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-neutral-800 hover:bg-neutral-100"
              >
                <GoogleIcon />
                Continue with Google
              </button>
              <div className="flex items-center gap-2 text-xs text-ink-faint">
                <span className="h-px flex-1 bg-line-strong" />
                or
                <span className="h-px flex-1 bg-line-strong" />
              </div>
              {status === "sent" ? (
                <div className="text-sm">
                  Check your email for a sign-in link. <span className="text-ink-dim">({email})</span>
                </div>
              ) : (
                <form
                  className="space-y-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    send();
                  }}
                >
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-md border border-line-strong bg-raised px-2 py-1.5 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={status === "sending"}
                    className="w-full rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-page hover:opacity-85 disabled:opacity-50"
                  >
                    {status === "sending" ? "Sending..." : "Send sign-in link"}
                  </button>
                  {status === "error" && <div className="text-xs text-red-400">{errorText}</div>}
                </form>
              )}
            </>
          ) : (
            <>
              <div>
                <div className="text-xs text-ink-dim">Signed in as</div>
                <div className="font-semibold break-all">{auth.email}</div>
              </div>
              <button
                type="button"
                onClick={auth.signOut}
                className="w-full rounded-md border border-line-strong bg-raised px-3 py-1.5 text-sm font-semibold hover:bg-raised-hover"
              >
                Sign out
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden>
      <path d="M10 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8a7 7 0 0 1 14 0H3z" />
    </svg>
  );
}

// Google's "G" logo, in its brand colors.
function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="w-4 h-4" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
