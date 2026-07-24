import React from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from "./ui/alert-dialog";

/** App-styled destructive confirmation on the shipped AlertDialog. Radix
 * gives us the safety defaults for free: focus lands on Cancel when the
 * dialog opens, and Escape cancels. Overlay clicks cancel via
 * onOverlayClick (AlertDialog blocks the default outside-dismiss). */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  onCancel(): void;
  onConfirm(): void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent
        onOverlayClick={onCancel}
        style={{
          background: "var(--lift)",
          border: "1px solid var(--hairline)",
          borderRadius: "var(--radius-card)",
          boxShadow: "var(--shadow-e4)",
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)" }}>
            {title}
          </AlertDialogTitle>
          {description && (
            <AlertDialogDescription style={{ fontSize: 13, color: "var(--fg-2)" }}>
              {description}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            className="sp-btn sp-btn-ghost"
            style={{ background: "transparent" }}
            onClick={onCancel}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="sp-btn"
            style={{ background: "var(--danger)", color: "#fff" }}
            onClick={onConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
