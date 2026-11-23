// Small line icons, drawn to match the gear icon. They use the text color (currentColor).

export function EditIcon({ className = "w-5 h-5" }: { className?: string }) {
  // A pencil over an open square.
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" />
      <path d="M18.4 2.6a2 2 0 0 1 2.9 2.9L12.6 14.2 8.5 15.5l1.3-4.1z" />
    </svg>
  );
}

export function TrashIcon({ className = "w-5 h-5" }: { className?: string }) {
  // A trash can with a lid handle and two lines.
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M3 6h18" />
      <path d="M9 6V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V6" />
      <path d="M5 6l1 13.5A2 2 0 0 0 8 21h8a2 2 0 0 0 2-1.5L19 6" />
      <path d="M10 10.5v6M14 10.5v6" />
    </svg>
  );
}

// Arrow next to a sortable column name: up, down, or a faint up-down when not sorted.
export function SortIcon({ direction }: { direction: "asc" | "desc" | false }) {
  if (direction === "asc") return <span aria-hidden>▲</span>;
  if (direction === "desc") return <span aria-hidden>▼</span>;
  return (
    <span className="opacity-30" aria-hidden>
      ⇅
    </span>
  );
}
