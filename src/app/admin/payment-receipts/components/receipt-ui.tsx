import type { BadgeTone } from "@/components/StatusBadge";
import {
  statusLabel,
  statusTone,
} from "@/app/admin/sale-orders/lib/so-display";

// Paths are the sheets' own, in a 24px viewBox.
const PATHS = {
  plus: "M12 5v14M5 12h14",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  close: "M6 6l12 12M18 6L6 18",
  chevron: "M6 9l6 6 6-6",
  prev: "M15 6l-6 6 6 6",
  next: "M9 6l6 6-6 6",
  check: "M5 12.5l4.5 4.5L19 7",
  money: "M3 7h18v10H3zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 10v.01M18 14v.01",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
  refund: "M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
  bank: "M3 10l9-6 9 6M5 10v8M19 10v8M9 10v8M15 10v8M3 20h18",
  cash: "M3 7h18v10H3zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  store: "M4 7h16l-1 12H5zM9 7a3 3 0 0 1 6 0",
  dots: "M6 12h.01M12 12h.01M18 12h.01",
  view: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  edit: "M4 20h4L19 9l-4-4L4 16zM13 7l4 4",
  print: "M7 9V3h10v6M7 17H5v-6h14v6h-2M7 14h10v7H7z",
  document: "M7 3h7l4 4v14H7zM14 3v4h4",
  documentLines: "M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5",
  delete: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01",
  alert: "M12 8v5M12 16.5v.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
  warning:
    "M12 9v4M12 17v.01M10.3 4l-8 14a2 2 0 0 0 1.7 3h16a2 2 0 0 0 1.7-3l-8-14a2 2 0 0 0-3.4 0z",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  searchMinus: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4M8 11h6",
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps {
  name: IconName;
  small?: boolean;
  size?: number;
  width?: number;
  draw?: boolean;
}

export function Icon({
  name,
  small = false,
  size,
  width,
  draw = false,
}: IconProps) {
  return (
    <svg
      className={`ka-pr-i${small ? " ka-pr-i--s" : ""}${name === "dots" ? " ka-pr-i--dots" : ""}`}
      style={
        size ? { width: size, height: size, strokeWidth: width } : undefined
      }
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d={PATHS[name]} data-draw={draw || undefined} />
    </svg>
  );
}

export function Badge({
  tone,
  children,
}: {
  tone: BadgeTone;
  children: React.ReactNode;
}) {
  return (
    <span className="ka-pr-bd ka-pr-tone" data-tone={tone}>
      {children}
    </span>
  );
}

export function OrderBadge({ status }: { status: string | undefined }) {
  return <Badge tone={statusTone(status)}>{statusLabel(status)}</Badge>;
}

/** The part of `text` that matches the search, tinted; a plain string when there is no match. */
export function Highlight({ text, term }: { text: string; term: string }) {
  const needle = term.trim().toLowerCase();
  const at = needle ? text.toLowerCase().indexOf(needle) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="ka-pr-hl">{text.slice(at, at + needle.length)}</mark>
      {text.slice(at + needle.length)}
    </>
  );
}
