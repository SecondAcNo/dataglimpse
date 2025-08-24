"use client";
import * as React from "react";
import { Snackbar, Alert } from "@mui/material";

type Kind = "success" | "info" | "warning" | "error";
type EnqueueArgs = { message: string; kind?: Kind };

const Ctx = React.createContext<(a: EnqueueArgs) => void>(() => {});

export function useSnackbar() {
  return React.useContext(Ctx);
}

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  const [kind, setKind] = React.useState<Kind>("info");

  const enqueue = React.useCallback(({ message, kind = "info" }: EnqueueArgs) => {
    setMsg(message);
    setKind(kind);
    setOpen(true);
  }, []);

  return (
    <Ctx.Provider value={enqueue}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={3500}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={() => setOpen(false)} severity={kind} variant="filled" elevation={2}>
          {msg}
        </Alert>
      </Snackbar>
    </Ctx.Provider>
  );
}
