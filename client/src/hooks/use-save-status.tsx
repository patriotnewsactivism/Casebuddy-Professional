import { createContext, useContext, useState, useCallback, ReactNode } from "react";

type SaveStatus = "saved" | "saving" | "error";

interface SaveStatusContextType {
  status: SaveStatus;
  lastSaved: Date | null;
  setSaving: () => void;
  setSaved: () => void;
  setError: () => void;
}

const SaveStatusContext = createContext<SaveStatusContextType | undefined>(undefined);

export function SaveStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const setSaving = useCallback(() => {
    setStatus("saving");
  }, []);

  const setSaved = useCallback(() => {
    setStatus("saved");
    setLastSaved(new Date());
  }, []);

  const setError = useCallback(() => {
    setStatus("error");
  }, []);

  return (
    <SaveStatusContext.Provider value={{ status, lastSaved, setSaving, setSaved, setError }}>
      {children}
    </SaveStatusContext.Provider>
  );
}

export function useSaveStatus() {
  const context = useContext(SaveStatusContext);
  if (!context) {
    throw new Error("useSaveStatus must be used within SaveStatusProvider");
  }
  return context;
}
