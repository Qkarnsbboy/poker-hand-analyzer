// View Hands: a sortable, filterable table of saved hands.
//
//   Filters (above the table): search name/notes, favorites only, stakes, hero position.
//   Sorting: click a column name. Click again to flip, a third time to clear.
//   Click a row to open the hand. Pencil = edit, trash = delete (asks once).
//
// TanStack Table does the sorting. Filtering is a few plain checks, done before it.

import { createColumnHelper, flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type SortingState } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import type { Hand } from "../lib/hand";
import { matchesSearch, shortDate, stakesOptions, toRow, type HandRow } from "../lib/hands-table";
import { formatMoney, useMoney } from "../lib/money";
import { deleteHand, listHands, setFavorite, type SavedHand } from "../lib/storage";
import { EditIcon, SortIcon, TrashIcon } from "./icons";
import { PlayingCard } from "./PlayingCard";

// Same columns for the header and every row: star, name, blinds, position, cards, board, pot, added, actions.
const grid = "grid grid-cols-[1.5rem_minmax(0,1fr)_4.5rem_5rem_5rem_12rem_5rem_6rem_4.5rem] items-center gap-3 px-4";
const control = "rounded-md border border-line-strong bg-raised px-2 py-1 text-sm";

const column = createColumnHelper<HandRow>();

export function HandsList({ onOpen, onEdit, onNew }: { onOpen: (hand: Hand) => void; onEdit: (hand: Hand) => void; onNew: () => void }) {
  const [saved, setSaved] = useState<SavedHand[] | null>(null); // null = still loading
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const { unit } = useMoney();

  // Filters.
  const [search, setSearch] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [stakes, setStakes] = useState(""); // "" = all
  const [position, setPosition] = useState(""); // "" = all
  const filtersOn = search !== "" || favoritesOnly || stakes !== "" || position !== "";
  const clearFilters = () => {
    setSearch("");
    setFavoritesOnly(false);
    setStakes("");
    setPosition("");
  };

  // Sorting (TanStack keeps it): e.g. [{ id: "pot", desc: true }]. Empty = saved order.
  const [sorting, setSorting] = useState<SortingState>([]);

  // Load the hands (from this browser for guests, from the database when logged in).
  const reload = () => {
    listHands()
      .then((result) => {
        setSaved(result);
        setLoadError(null);
      })
      .catch((e: Error) => setLoadError(e.message));
  };
  useEffect(reload, []);

  const remove = async (id: string) => {
    setConfirmingDelete(null);
    await deleteHand(id);
    reload();
  };

  // Flip the star right away, then save it.
  const toggleStar = async (id: string, favorite: boolean) => {
    setSaved((current) => (current ?? []).map((row) => (row.hand.id === id ? { ...row, favorite } : row)));
    await setFavorite(id, favorite);
  };

  // Every hand as a table row, then the filters.
  const allRows = useMemo(() => (saved ?? []).map(toRow), [saved]);
  const shownRows = useMemo(() => {
    const result: HandRow[] = [];
    for (const row of allRows) {
      if (!matchesSearch(row, search)) continue;
      if (favoritesOnly && !row.favorite) continue;
      if (stakes !== "" && row.stakes !== stakes) continue;
      if (position !== "" && row.position !== position) continue;
      result.push(row);
    }
    return result;
  }, [allRows, search, favoritesOnly, stakes, position]);

  const columns = [
    column.accessor("favorite", {
      header: "",
      enableSorting: false, // use the "★ Favorites" filter instead
      cell: (info) => {
        const row = info.row.original;
        return (
          <button
            type="button"
            title={row.favorite ? "Unfavorite" : "Favorite"}
            onClick={(event) => {
              event.stopPropagation(); // don't open the hand
              toggleStar(row.id, !row.favorite);
            }}
            className={"text-xl leading-none " + (row.favorite ? "text-yellow-400" : "text-ink-faint hover:text-ink-dim")}
          >
            {row.favorite ? "★" : "☆"}
          </button>
        );
      },
    }),
    column.accessor("name", {
      header: "Hand Name",
      cell: (info) => <span className="block font-bold truncate">{info.getValue()}</span>,
    }),
    column.accessor("bigBlind", {
      header: "Blinds",
      cell: (info) => info.row.original.stakes,
    }),
    column.accessor("position", { header: "Position" }),
    column.display({
      id: "cards",
      header: "Cards",
      cell: (info) => {
        const hand = info.row.original.saved.hand;
        const hero = hand.players.find((p) => p.position === hand.hero)!;
        if (!hero.cards) return <span className="text-ink-faint">?</span>;
        return (
          <span className="flex gap-1">
            {hero.cards.map((card) => (
              <PlayingCard key={card} card={card} size="xs" />
            ))}
          </span>
        );
      },
    }),
    column.display({
      id: "board",
      header: "Board",
      cell: (info) => {
        const board = info.row.original.saved.hand.board;
        const cards = [...(board.flop ?? [null, null, null]), board.turn, board.river];
        return (
          <span className="flex gap-1">
            {cards.map((card, i) =>
              card ? <PlayingCard key={i} card={card} size="xs" /> : <span key={i} className="w-8 h-10 rounded-md border border-dashed border-line-strong" />,
            )}
          </span>
        );
      },
    }),
    column.accessor("pot", {
      header: "Pot",
      sortDescFirst: true, // first click: biggest pots on top
      cell: (info) => <span className="font-semibold">{formatMoney(info.getValue(), info.row.original.bigBlind, unit)}</span>,
    }),
    column.accessor("createdAt", {
      header: "Added",
      sortDescFirst: true, // first click: newest on top
      sortingFn: (a, b) => (a.original.createdAt ?? 0) - (b.original.createdAt ?? 0), // unknown dates count as oldest
      cell: (info) => <span className="text-ink-dim">{shortDate(info.getValue())}</span>,
    }),
    column.display({
      id: "actions",
      header: "",
      cell: (info) => {
        const row = info.row.original;
        return (
          <span className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
            <button type="button" title="Edit" onClick={() => onEdit(row.saved.hand)} className="rounded-md p-1.5 text-ink-dim hover:bg-raised-hover hover:text-green-600">
              <EditIcon />
            </button>
            {confirmingDelete === row.id ? (
              <button
                type="button"
                autoFocus
                onClick={() => remove(row.id)}
                onBlur={() => setConfirmingDelete(null)}
                className="rounded-md bg-red-600 px-2 py-1 text-xs font-bold text-white hover:bg-red-500"
              >
                Delete?
              </button>
            ) : (
              <button type="button" title="Delete" onClick={() => setConfirmingDelete(row.id)} className="rounded-md p-1.5 text-ink-dim hover:bg-raised-hover hover:text-red-600">
                <TrashIcon />
              </button>
            )}
          </span>
        );
      },
    }),
  ];

  const table = useReactTable({
    data: shownRows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.id,
  });

  if (loadError) return <div className="p-10 text-center text-red-400">Couldn't load your hands: {loadError}</div>;
  if (saved === null) return <div className="p-10 text-center text-ink-faint">Loading hands...</div>;

  return (
    <div className="space-y-2">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 pb-2">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or notes..." className={control + " w-64"} />
        <button
          type="button"
          onClick={() => setFavoritesOnly(!favoritesOnly)}
          className={"rounded-md border px-2 py-1 text-sm font-semibold " + (favoritesOnly ? "border-yellow-500 bg-yellow-400/20 text-ink" : "border-line-strong bg-raised text-ink-dim")}
        >
          ★ Favorites
        </button>
        <select value={stakes} onChange={(event) => setStakes(event.target.value)} className={control}>
          <option value="">All stakes</option>
          {stakesOptions(allRows).map((label) => (
            <option key={label} value={label}>
              {label}
            </option>
          ))}
        </select>
        <select value={position} onChange={(event) => setPosition(event.target.value)} className={control}>
          <option value="">All positions</option>
          <option value="BTN">BTN</option>
          <option value="BB">BB</option>
        </select>
      </div>

      {/* Column names. Sortable ones are buttons. */}
      {table.getHeaderGroups().map((group) => (
        <div key={group.id} className={grid + " pb-2 border-b-2 border-line-strong text-sm font-bold text-ink-dim"}>
          {group.headers.map((header) => {
            const name = flexRender(header.column.columnDef.header, header.getContext());
            if (!header.column.getCanSort()) return <span key={header.id}>{name}</span>;
            return (
              <button key={header.id} type="button" onClick={header.column.getToggleSortingHandler()} className="flex items-center gap-1 text-left hover:text-ink">
                {name} <SortIcon direction={header.column.getIsSorted()} />
              </button>
            );
          })}
        </div>
      ))}

      {/* One row per hand. Click it to open. */}
      {table.getRowModel().rows.map((row) => (
        <div
          key={row.id}
          role="button"
          tabIndex={0}
          onClick={() => onOpen(row.original.saved.hand)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onOpen(row.original.saved.hand);
          }}
          className={grid + " cursor-pointer rounded-2xl border border-line bg-panel py-3 hover:border-line-strong hover:bg-raised"}
        >
          {row.getVisibleCells().map((cell) => (
            <span key={cell.id} className="min-w-0">
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </span>
          ))}
        </div>
      ))}

      {shownRows.length === 0 && allRows.length > 0 && <div className="py-6 text-center text-ink-faint">No hands match these filters.</div>}

      {/* Count, and a quick way back to everything. */}
      {filtersOn && (
        <div className="flex justify-center gap-2 text-sm text-ink-dim">
          Showing {shownRows.length} of {allRows.length} hands ·
          <button type="button" onClick={clearFilters} className="underline hover:text-ink">
            Clear filters
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={onNew}
        title="New hand"
        className="w-full h-16 rounded-2xl border border-line bg-panel text-3xl font-bold text-ink-dim hover:bg-raised-hover"
      >
        +
      </button>
    </div>
  );
}
