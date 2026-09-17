"use client";
import { useEffect, useRef, useId, type ReactNode } from "react";
import { usePresence } from "@/components/use-presence";
export function ConfirmDialog({
  open,
  onClose,
  title,
  children,
  onConfirm,
  confirmLabel,
  danger = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  onConfirm: () => void;
  confirmLabel: string;
  danger?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const present = usePresence(open);
  const id = useId();
  const last = useRef({ title, children, confirmLabel, danger });
  if (open) last.current = { title, children, confirmLabel, danger };
  useEffect(() => {
    const el = dialog.current;
    if (present && !el?.open) {
      el?.showModal();
      cancel.current?.focus();
    } else if (!present && el?.open) el.close();
  }, [present]);
  const content = open
    ? { title, children, confirmLabel, danger }
    : last.current;
  return (
    <dialog
      className="account-dialog"
      ref={dialog}
      aria-labelledby={id}
      data-state={open ? "open" : "closed"}
      onKeyDown={(e) => {
        if (e.key !== "Tab" || !open) return;
        const items = Array.from(
          e.currentTarget.querySelectorAll<HTMLElement>(
            'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]',
          ),
        ).filter((el) => el.getClientRects().length > 0);
        const first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div inert={!open}>
        <h2 id={id}>{content.title}</h2>
        {content.children}
        <div className="dialog-actions">
          <button ref={cancel} className="button secondary" onClick={onClose}>
            Annuleren
          </button>
          <button
            className={content.danger ? "button danger" : "button primary"}
            onClick={onConfirm}
          >
            {content.confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
