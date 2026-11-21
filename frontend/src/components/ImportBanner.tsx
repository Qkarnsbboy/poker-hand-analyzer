// After sign-in: offer to move the hands the guest made in this browser into the account.

import { useState } from "react";
import { forgetBrowserHands, guestHandsToImport, saveHand } from "../lib/storage";

export function ImportBanner({ onImported }: { onImported: () => void }) {
  // Read once: the guest's own hands still in this browser.
  const [hands] = useState(guestHandsToImport);
  const [status, setStatus] = useState<"ask" | "importing" | "done" | "dismissed" | "error">("ask");

  if (hands.length === 0 || status === "dismissed") return null;

  const importAll = async () => {
    setStatus("importing");
    const imported: string[] = [];
    try {
      for (const hand of hands) {
        await saveHand(hand); // logged in, so this goes to the database
        imported.push(hand.id);
      }
      setStatus("done");
      onImported();
    } catch {
      setStatus("error");
    } finally {
      // Remove only the ones that made it, so nothing is lost if one fails.
      forgetBrowserHands(imported);
    }
  };

  const count = hands.length === 1 ? "1 hand" : `${hands.length} hands`;
  return (
    <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-accent bg-raised px-4 py-3 text-sm">
      {status === "done" && <span>Imported {count} into your account.</span>}
      {status === "error" && <span className="text-red-400">Some hands could not be imported. Try again later.</span>}
      {(status === "ask" || status === "importing") && (
        <span>
          You have <b>{count}</b> from before you signed in. Import into your account?
        </span>
      )}
      <div className="flex shrink-0 gap-2">
        {status === "ask" && (
          <button type="button" onClick={importAll} className="rounded-md bg-accent px-3 py-1 font-semibold text-page hover:opacity-85">
            Import
          </button>
        )}
        {status === "importing" && <span className="text-ink-dim">Importing...</span>}
        <button type="button" onClick={() => setStatus("dismissed")} className="rounded-md border border-line-strong px-3 py-1 hover:bg-raised-hover">
          {status === "done" || status === "error" ? "Close" : "Not now"}
        </button>
      </div>
    </div>
  );
}
