import { useEffect, useMemo, useRef, useState } from "react";
import { RiSearchLine } from "@remixicon/react";
import { useNavigate } from "react-router-dom";
import { Kbd } from "@/components/base/kbd/kbd";
import { Modal, ModalDialog } from "@/components/base/modal/modal";
import { APP_NAV_ITEMS } from "@/components/layout/nav";

export const OPEN_SEARCH_EVENT = "sisarpras:open-search";

/**
 * Keyboard-driven feature search (⌘K / Ctrl+K).
 * Opens from the sidebar's "Cari cepat" button or the shortcut, filters the
 * navigation list, and navigates on Enter.
 */
export function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return APP_NAV_ITEMS;
    return APP_NAV_ITEMS.filter((item) => item.label.toLowerCase().includes(needle));
  }, [query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => window.clearTimeout(timer);
  }, [open]);

  function go(index: number) {
    const item = results[index];
    if (!item) return;
    navigate(item.href ?? "/dashboard");
    onClose();
  }

  return (
    <Modal isOpen={open} onOpenChange={(next) => !next && onClose()} size="lg" aria-label="Cari fitur">
      <ModalDialog aria-label="Cari fitur">
        <div className="flex items-center gap-2 rounded-xl border border-border-button-default bg-background-secondary-default px-3 py-2">
          <RiSearchLine className="size-4 shrink-0 text-foreground-icon-quaternary" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((current) => Math.min(current + 1, Math.max(results.length - 1, 0)));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((current) => Math.max(current - 1, 0));
              } else if (event.key === "Enter") {
                event.preventDefault();
                go(activeIndex);
              } else if (event.key === "Escape") {
                onClose();
              }
            }}
            placeholder="Cari fitur…"
            aria-label="Cari fitur"
            className="w-full bg-transparent text-body text-text-primary outline-none placeholder:text-text-placeholder"
          />
          <Kbd>Esc</Kbd>
        </div>

        <div className="mt-3 flex max-h-[320px] flex-col gap-1 overflow-y-auto">
          {results.map((item, index) => {
            const Icon = item.icon;
            const isActive = index === activeIndex;
            return (
              <button
                key={item.key}
                type="button"
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => go(index)}
                className={
                  "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors " +
                  (isActive ? "bg-accent-50 text-accent-700" : "text-text-secondary hover:bg-background-secondary-default")
                }
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="flex-1 text-body-medium">{item.label}</span>
                {isActive && <Kbd>↵</Kbd>}
              </button>
            );
          })}

          {results.length === 0 && (
            <div className="px-3 py-8 text-center text-caption-1-regular text-text-tertiary">
              Tidak ada fitur yang cocok dengan "{query}".
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center gap-3 border-t border-separator-border pt-3 text-caption-2-regular text-text-tertiary">
          <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> pilih</span>
          <span className="flex items-center gap-1"><Kbd>↵</Kbd> buka</span>
          <span className="flex items-center gap-1"><Kbd>Esc</Kbd> tutup</span>
        </div>
      </ModalDialog>
    </Modal>
  );
}
