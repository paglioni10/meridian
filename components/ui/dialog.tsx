"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function Dialog({
  open,
  onClose,
  title,
  children,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="dialog-title"
      className="modal fixed inset-x-0 top-auto bottom-0 m-0 max-w-none text-foreground backdrop:bg-background/80 backdrop:backdrop-blur-overlay md:inset-0 md:m-auto md:max-w-lg"
    >
      <h2 id="dialog-title" className="modal-title">
        {title}
      </h2>
      <div className="flex flex-col gap-4">{children}</div>
      {actions ? <div className="modal-actions">{actions}</div> : null}
    </dialog>
  );
}
