"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  emptyWorkspace,
  readWorkspace,
  writeWorkspace,
  removeWorkspace,
} from "@/lib/storage";
import { syncContacts } from "@/lib/contact-data";
import { Toast } from "@/components/toast";
import type { Workspace } from "@/lib/types";
const Context = createContext<{
  data: Workspace;
  ready: boolean;
  save: (data: Workspace, message?: string) => boolean;
  signedOut: boolean;
  logout: () => void;
  resume: () => void;
  deleteAccount: () => boolean;
}>({
  data: emptyWorkspace,
  ready: false,
  save: () => false,
  signedOut: false,
  logout: () => {},
  resume: () => {},
  deleteAccount: () => false,
});
const SESSION_KEY = "marketing-ai.signed-out";
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState(emptyWorkspace);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ id: number; message: string } | null>(
    null,
  );
  const closeToast = useCallback(() => setToast(null), []);
  const [signedOut, setSignedOut] = useState(false);
  // Keep contact-data.ts's live bridge in sync before children render (not in
  // an effect, which would run one tick too late and leave the first render
  // after any data change reading stale contacts).
  syncContacts(data.contacts);
  useEffect(() => {
    try {
      setSignedOut(localStorage.getItem(SESSION_KEY) === "true");
      setData(readWorkspace());
    } catch {
      setError(
        "Je lokale gegevens konden niet worden geladen. Controleer de browseropslag.",
      );
    }
    setReady(true);
  }, []);
  function save(next: Workspace, message?: string) {
    try {
      writeWorkspace(next);
      const changedPost = next.posts.find(
        (p) => p.status !== data.posts.find((old) => old.id === p.id)?.status,
      );
      const changedEmail = next.email?.campaigns.find(
        (c) =>
          c.status !==
          data.email?.campaigns.find((old) => old.id === c.id)?.status,
      );
      const changed = changedEmail || changedPost;
      const activated =
        (next.email?.settings.enabled &&
          next.email.settings.mode !== data.email?.settings.mode) ||
        (next.instagram?.enabled &&
          next.instagram.mode !== data.instagram?.mode);
      const autoMessage =
        changed?.status === "scheduled"
          ? "Content ingepland"
          : changed?.status === "approved"
            ? "Content goedgekeurd"
            : changed?.status === "rejected"
              ? "Concept afgewezen"
              : activated
                ? "Autopilot geactiveerd"
                : next.email !== data.email
                  ? next.email?.campaigns !== data.email?.campaigns
                    ? "Campagne opgeslagen"
                    : "Autopilot-instellingen opgeslagen"
                  : "Wijzigingen opgeslagen";
      setToast({ id: Date.now(), message: message || autoMessage });
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
  function changeSession(out: boolean) {
    try {
      localStorage.setItem(SESSION_KEY, String(out));
      setSignedOut(out);
      setError("");
    } catch {
      setError(
        "De lokale sessie kon niet worden bijgewerkt. Controleer je browseropslag.",
      );
    }
  }
  function deleteAccount() {
    try {
      removeWorkspace();
      setData(structuredClone(emptyWorkspace));
      setError("");
      return true;
    } catch {
      setError(
        "Verwijderen is niet gelukt. Controleer je browseropslag en probeer opnieuw.",
      );
      return false;
    }
  }
  return (
    <Context.Provider
      value={{
        data,
        ready,
        save,
        signedOut,
        logout: () => changeSession(true),
        resume: () => changeSession(false),
        deleteAccount,
      }}
    >
      {error && (
        <div role="alert" className="storage-error">
          {error}
        </div>
      )}
      {children}
      {toast && (
        <Toast key={toast.id} message={toast.message} onClose={closeToast} />
      )}
    </Context.Provider>
  );
}
export const useWorkspace = () => useContext(Context);
