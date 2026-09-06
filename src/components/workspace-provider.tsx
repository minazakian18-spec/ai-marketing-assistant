"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { emptyWorkspace, readWorkspace, writeWorkspace } from "@/lib/storage";
import type { Workspace } from "@/lib/types";
const Context = createContext<{
  data: Workspace;
  ready: boolean;
  save: (data: Workspace) => boolean;
}>({ data: emptyWorkspace, ready: false, save: () => false });
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState(emptyWorkspace);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    try {
      setData(readWorkspace());
    } catch {
      setError(
        "Je lokale gegevens konden niet worden geladen. Controleer de browseropslag.",
      );
    }
    setReady(true);
  }, []);
  function save(next: Workspace) {
    try {
      writeWorkspace(next);
      setData(next);
      setError("");
      return true;
    } catch {
      setError(
        "Opslaan is niet gelukt. Controleer of je browser lokale opslag toestaat en voldoende ruimte heeft.",
      );
      return false;
    }
  }
  return (
    <Context.Provider value={{ data, ready, save }}>
      {error && (
        <div role="alert" className="storage-error">
          {error}
        </div>
      )}
      {children}
    </Context.Provider>
  );
}
export const useWorkspace = () => useContext(Context);
