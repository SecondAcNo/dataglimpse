"use client";
import * as React from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from "@mui/material";

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message?: React.ReactNode;
  onClose: () => void;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: "primary" | "error";
  disableConfirm?: boolean;
};

export default function ConfirmDialog({
  open,
  title,
  message,
  onClose,
  onConfirm,
  confirmText = "OK",
  cancelText = "キャンセル",
  confirmColor = "primary",
  disableConfirm = false,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{title}</DialogTitle>
      {message && <DialogContent dividers>{message}</DialogContent>}
      <DialogActions>
        <Button onClick={onClose}>{cancelText}</Button>
        <Button onClick={onConfirm} color={confirmColor} variant="contained" disabled={disableConfirm}>
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
