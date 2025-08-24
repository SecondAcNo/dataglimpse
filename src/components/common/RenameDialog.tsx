"use client";
import * as React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
} from "@mui/material";

export type RenameDialogProps = {
  open: boolean;
  title?: string;
  initialValue: string;
  label?: string;
  onClose: () => void;
  onSubmit: (newName: string) => void;
  submitText?: string;
};

export default function RenameDialog({
  open,
  title = "名前の変更",
  initialValue,
  label = "新しい名前",
  onClose,
  onSubmit,
  submitText = "変更",
}: RenameDialogProps) {
  const [value, setValue] = React.useState(initialValue);

  // 依存配列は固定長（1要素）にする：prop が変わったら同期
  React.useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const trimmed = value.trim();
  const disabled = trimmed.length === 0 || trimmed === initialValue;

  const handleSubmit = () => {
    if (disabled) return;
    onSubmit(trimmed);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent sx={{ minWidth: 360 }}> {/* 見切れ防止の下限幅 */}
        <TextField
          fullWidth
          autoFocus
          margin="dense"
          label={label}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={disabled}
        >
          {submitText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
