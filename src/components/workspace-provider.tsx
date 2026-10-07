"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { stopDemo } from "@/lib/demo";
import { emptyWorkspace, readWorkspace, writeWorkspace } from "@/lib/storage";
import { syncContacts } from "@/lib/contact-data";
import { Toast } from "@/components/toast";
import { authRequest } from "@/lib/auth-client";
import type { Workspace } from "@/lib/types";
const Context = createContext<{
  data: Workspace;
  ready: boolean;
  save: (data: Workspace, message?: string) => Promise<boolean>;
  signedOut: boolean;
  logout: () => void;
  resume: () => void;
  deleteAccount: () => boolean;
}>({
  data: emptyWorkspace,
  ready: false,
  save: async () => false,
  signedOut: false,
  logout: () => {},
  resume: () => {},
  deleteAccount: () => false,
});
export function WorkspaceProvider({
  children,
  demo = false,
}: {
  children: ReactNode;
  demo?: boolean;
}) {
  const [data, setData] = useState<Workspace>(() => ({
    ...structuredClone(emptyWorkspace),
    contacts: [],
    library: [],
    review: { ...emptyWorkspace.review, reviews: [] },
  }));
  const [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState("");
  const version = useRef(0),
    busy = useRef(false),
    role = useRef("MEMBER");
  const close = useCallback(() => setToast(""), []);
  syncContacts(data.contacts);
  useEffect(() => {
    if (demo) {
      try {
        const local = readWorkspace();
        setData(local);
        role.current = "OWNER";
        setReady(true);
      } catch {
        setData(structuredClone(emptyWorkspace));
        role.current = "OWNER";
        setReady(true);
        setError(
          "Opgeslagen testgegevens konden niet worden geladen. Je kunt met nieuwe voorbeeldgegevens verder.",
        );
      }
      return;
    }
    let active = true;
    fetch("/api/workspace", { cache: "no-store" })
      .then(async (r) => {
        const result = await r.json();
        if (!r.ok) throw new Error(result.error || "Laden mislukt.");
        if (active) {
          setData(result.data);
          version.current = result.version;
          role.current = result.role;
          setReady(true);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [demo]);
  async function save(next: Workspace, message = "Wijzigingen opgeslagen") {
    if (!ready || busy.current) {
      setError("Wacht tot de vorige wijziging is opgeslagen.");
      return false;
    }
    if (role.current === "MEMBER") {
      setError("Je hebt geen toestemming om deze werkruimte te wijzigen.");
      return false;
    }
    busy.current = true;
    setError("");
    try {
      if (demo) {
        writeWorkspace(next);
        setData(next);
        setToast(message);
        return true;
      }
      const response = await fetch("/api/workspace", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: next, version: version.current }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Opslaan mislukt.");
      version.current = result.version;
      setData(next);
      setToast(message);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Opslaan mislukt.");
      return false;
    } finally {
      busy.current = false;
    }
  }
  return (
    <Context.Provider
      value={{
        data,
        ready,
        save,
        signedOut: false,
        logout: () => {
          if (demo) {
            stopDemo();
            return;
          }
          void authRequest("logout").catch((e) => setError(e.message));
        },
        resume: () => window.location.assign("/login"),
        deleteAccount: () => {
          setError(
            "Gebruik de beveiligde verwijderprocedure. Er zijn geen gegevens verwijderd.",
          );
          return false;
        },
      }}
    >
      {demo && (
        <div className="mkt-auth-banner mkt-auth-banner-info" role="status">
          Testmodus — voorbeeldgegevens, lokaal opgeslagen. AI-content is
          gesimuleerd. Koppelingen, facturatie en accountbeheer vereisen een
          echt account.{" "}
          <button type="button" onClick={stopDemo}>
            Testmodus verlaten
          </button>
        </div>
      )}
      {error && (
        <div className="storage-error" role="alert">
          {error}
        </div>
      )}
      {ready ? (
        children
      ) : (
        <div className="ws-boot" role="status" aria-live="polite">
          {error ? (
            <>
              <strong>Je werkruimte is even niet bereikbaar</strong>
              <p>Controleer je verbinding en probeer het opnieuw.</p>
              <button type="button" className="button secondary" onClick={() => window.location.reload()}>
                Opnieuw proberen
              </button>
            </>
          ) : (
            <>
              <span className="ws-boot-mark" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <p>Je werkruimte wordt geladen…</p>
            </>
          )}
        </div>
      )}
      {toast && <Toast message={toast} onClose={close} />}
    </Context.Provider>
  );
}
export const useWorkspace = () => useContext(Context);
