"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  FileSpreadsheet,
  Search,
  MoreHorizontal,
  Pencil,
  Tags,
  Trash2,
  Mail,
  Users,
} from "lucide-react";
import { usePresence } from "@/components/use-presence";
import { useWorkspace } from "@/components/workspace-provider";
import { ConfirmDialog } from "@/components/account/confirm-dialog";
import { ContactFormDialog } from "./contact-form-dialog";
import { ImportWizard } from "./import-wizard";
import { contactName, distinctGroups, segmentForGroup } from "@/lib/contact-data";
import { parseContactFile, type ParsedSheet } from "@/lib/contact-import";
import type { Contact } from "@/lib/types";

function ContactRowMenu({
  contact,
  onEdit,
  onGroup,
  onDelete,
}: {
  contact: Contact;
  onEdit: () => void;
  onGroup: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const present = usePresence(open);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function outside(e: PointerEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    function escape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div className="lib-menu-wrap" ref={root}>
      <button
        type="button"
        className="lib-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={"Acties voor " + contactName(contact)}
        onClick={() => setOpen(!open)}
      >
        <MoreHorizontal size={17} />
      </button>
      {present && (
        <div
          className="lib-menu"
          role="menu"
          data-state={open ? "open" : "closed"}
          inert={!open}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
          >
            <Pencil size={15} /> Bewerken
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onGroup();
            }}
          >
            <Tags size={15} /> Voeg toe aan groep
          </button>
          <button
            type="button"
            role="menuitem"
            className="lib-menu-danger"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            <Trash2 size={15} /> Verwijderen
          </button>
        </div>
      )}
    </div>
  );
}

type Filter = "all" | "recent" | string;

export function ContactsManager() {
  const { data, save } = useWorkspace();
  const router = useRouter();
  const contacts = data.contacts;
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [importSheet, setImportSheet] = useState<ParsedSheet | null>(null);
  const [importFileName, setImportFileName] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Contact | "bulk" | null>(
    null,
  );
  const [groupPromptFor, setGroupPromptFor] = useState<
    "bulk" | Contact | null
  >(null);
  const [groupDraft, setGroupDraft] = useState("");
  const [message, setMessage] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const groups = useMemo(() => distinctGroups(contacts), [contacts]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return contacts.filter((c) => {
      if (filter === "recent") {
        const days = (Date.now() - new Date(c.createdAt).getTime()) / 86400000;
        if (days > 30) return false;
      } else if (filter !== "all" && c.group !== filter) return false;
      if (!term) return true;
      return (
        contactName(c).toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term) ||
        (c.company || "").toLowerCase().includes(term)
      );
    });
  }, [contacts, search, filter]);

  async function persistContacts(next: Contact[], msg: string) {
    if (await save({ ...data, contacts: next })) setMessage(msg);
  }
  function upsertContact(contact: Contact) {
    const exists = contacts.some((c) => c.id === contact.id);
    persistContacts(
      exists
        ? contacts.map((c) => (c.id === contact.id ? contact : c))
        : [contact, ...contacts],
      exists ? "Contact bijgewerkt." : "Contact toegevoegd.",
    );
    setFormOpen(false);
    setEditingContact(null);
  }
  async function handleFile(file: File | undefined) {
    if (!file) return;
    setMessage("");
    try {
      const sheet = await parseContactFile(file);
      if (!sheet.headers.length) {
        setMessage("Kon geen kolommen vinden in dit bestand.");
        return;
      }
      setImportSheet(sheet);
      setImportFileName(file.name);
      setImportOpen(true);
    } catch {
      setMessage(
        "Dit bestand kon niet worden gelezen. Gebruik een .xlsx-, .xls- of .csv-bestand.",
      );
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  function handleImport(imported: Contact[]) {
    persistContacts(
      [...imported, ...contacts],
      imported.length + " contacten geïmporteerd.",
    );
    setImportSheet(null);
  }
  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleSelectAll() {
    setSelected((prev) =>
      prev.size === filtered.length && filtered.length > 0
        ? new Set()
        : new Set(filtered.map((c) => c.id)),
    );
  }
  function applyGroup(target: "bulk" | Contact) {
    const name = groupDraft.trim();
    if (!name) return;
    const ids = target === "bulk" ? selected : new Set([target.id]);
    persistContacts(
      contacts.map((c) => (ids.has(c.id) ? { ...c, group: name } : c)),
      ids.size +
        " contact" +
        (ids.size === 1 ? "" : "en") +
        " toegevoegd aan '" +
        name +
        "'.",
    );
    setGroupPromptFor(null);
    setGroupDraft("");
    if (target === "bulk") setSelected(new Set());
  }
  function confirmDelete() {
    if (deleteTarget === "bulk") {
      persistContacts(
        contacts.filter((c) => !selected.has(c.id)),
        selected.size + " contacten verwijderd.",
      );
      setSelected(new Set());
    } else if (deleteTarget) {
      persistContacts(
        contacts.filter((c) => c.id !== deleteTarget.id),
        "Contact verwijderd.",
      );
    }
    setDeleteTarget(null);
  }
  const openAddForm = () => {
    setEditingContact(null);
    setFormOpen(true);
  };
  return (
    <div className="contacts-manager">
      <div className="contacts-top-row">
        <span className="contacts-count">
          {contacts.length} contact{contacts.length === 1 ? "" : "en"}
        </span>
        <div className="contacts-header-actions">
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,.xls,.csv"
            hidden
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
          <button
            type="button"
            className="button secondary"
            onClick={() => fileInput.current?.click()}
          >
            <FileSpreadsheet size={16} />
            Excel importeren
          </button>
          <button type="button" className="button primary" onClick={openAddForm}>
            <Plus size={16} />
            Contact toevoegen
          </button>
        </div>
      </div>
      <p role="status" className="ig-feedback ig-top-feedback">
        {message}
      </p>
      {contacts.length === 0 ? (
        <div className="panel ig-empty contacts-empty">
          <Users size={28} />
          <h2>Bouw je publiek op</h2>
          <p>
            Voeg e-mailadressen van klanten handmatig toe of importeer ze via
            Excel om aan de slag te gaan met Email AI.
          </p>
          <div className="contacts-header-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => fileInput.current?.click()}
            >
              <FileSpreadsheet size={16} />
              Excel importeren
            </button>
            <button type="button" className="button primary" onClick={openAddForm}>
              <Plus size={16} />
              Contact toevoegen
            </button>
          </div>
        </div>
      ) : (
        <section className="panel">
          <div className="contacts-toolbar">
            <div className="contacts-search">
              <Search size={15} />
              <input
                aria-label="Zoek contacten"
                placeholder="Zoek contacten..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div
              className="contacts-filters"
              role="group"
              aria-label="Filter contacten"
            >
              <button
                type="button"
                className="lib-filter-pill"
                aria-pressed={filter === "all"}
                onClick={() => setFilter("all")}
              >
                Alle contacten
              </button>
              <button
                type="button"
                className="lib-filter-pill"
                aria-pressed={filter === "recent"}
                onClick={() => setFilter("recent")}
              >
                Recent
              </button>
              {groups.map((g) => (
                <button
                  key={g}
                  type="button"
                  className="lib-filter-pill"
                  aria-pressed={filter === g}
                  onClick={() => setFilter(g)}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
          {selected.size > 0 && (
            <div className="contacts-bulk-bar">
              <span>{selected.size} geselecteerd</span>
              <div className="contacts-bulk-actions">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => {
                    setGroupDraft("");
                    setGroupPromptFor("bulk");
                  }}
                >
                  <Tags size={14} /> Voeg toe aan groep
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => {
                    const chosen = contacts.filter((c) => selected.has(c.id));
                    const groups = new Set(chosen.map((c) => c.group || ""));
                    if (groups.size > 1) {
                      setMessage(
                        "Je selectie bevat meerdere groepen. Filter eerst op één groep, of kies zelf de juiste doelgroep bij 'Doelgroep kiezen' in Email AI.",
                      );
                      return;
                    }
                    const segment = segmentForGroup(chosen[0]?.group);
                    router.push(
                      "/email-ai?tab=assist&audience=" +
                        encodeURIComponent(segment),
                    );
                  }}
                >
                  <Mail size={14} /> Gebruik in campagne
                </button>
                <button
                  type="button"
                  className="button danger-outline"
                  onClick={() => setDeleteTarget("bulk")}
                >
                  <Trash2 size={14} /> Verwijderen
                </button>
              </div>
            </div>
          )}
          <div className="invoice-scroll">
            <table className="invoice-table contacts-table">
              <caption className="sr-only">Contacten</caption>
              <thead>
                <tr>
                  <th scope="col">
                    <input
                      type="checkbox"
                      aria-label="Selecteer alle contacten"
                      checked={
                        selected.size > 0 && selected.size === filtered.length
                      }
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th scope="col">Naam</th>
                  <th scope="col">E-mail</th>
                  <th scope="col">Bedrijf</th>
                  <th scope="col">Tag / groep</th>
                  <th scope="col">Datum toegevoegd</th>
                  <th scope="col">
                    <span className="sr-only">Acties</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={"Selecteer " + contactName(c)}
                        checked={selected.has(c.id)}
                        onChange={() => toggleSelect(c.id)}
                      />
                    </td>
                    <td className="contacts-name-cell">
                      <strong>{contactName(c)}</strong>
                      {c.phone && <span>{c.phone}</span>}
                    </td>
                    <td>{c.email}</td>
                    <td>{c.company || "—"}</td>
                    <td>
                      {c.group ? (
                        <span className="contacts-group-chip">{c.group}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {new Date(c.createdAt).toLocaleDateString("nl-NL", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td>
                      <ContactRowMenu
                        contact={c}
                        onEdit={() => {
                          setEditingContact(c);
                          setFormOpen(true);
                        }}
                        onGroup={() => {
                          setGroupDraft(c.group || "");
                          setGroupPromptFor(c);
                        }}
                        onDelete={() => setDeleteTarget(c)}
                      />
                    </td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td colSpan={7} className="field-note">
                      Geen contacten gevonden voor dit filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <ContactFormDialog
        open={formOpen}
        contact={editingContact}
        groups={groups}
        existingEmails={contacts
          .filter((c) => c.id !== editingContact?.id)
          .map((c) => c.email.toLowerCase())}
        onClose={() => {
          setFormOpen(false);
          setEditingContact(null);
        }}
        onSave={upsertContact}
      />
      <ImportWizard
        open={importOpen}
        sheet={importSheet}
        fileName={importFileName}
        existingContacts={contacts}
        onClose={() => setImportOpen(false)}
        onImport={handleImport}
      />
      <ConfirmDialog
        open={groupPromptFor !== null}
        onClose={() => setGroupPromptFor(null)}
        title="Voeg toe aan groep"
        confirmLabel="Toepassen"
        onConfirm={() => groupPromptFor && applyGroup(groupPromptFor)}
      >
        <label>
          Groepsnaam
          <input
            list="contacts-group-list"
            value={groupDraft}
            maxLength={60}
            placeholder="Bijv. Klanten, Leads, VIP klanten"
            onChange={(e) => setGroupDraft(e.target.value)}
          />
          <datalist id="contacts-group-list">
            {groups.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </label>
      </ConfirmDialog>
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Contact verwijderen?"
        confirmLabel="Verwijderen"
        danger
        onConfirm={confirmDelete}
      >
        <p>
          {deleteTarget === "bulk"
            ? "Weet je zeker dat je " +
              selected.size +
              " contacten wilt verwijderen? Dit kan niet ongedaan worden gemaakt."
            : "Weet je zeker dat je “" +
              (deleteTarget ? contactName(deleteTarget) : "") +
              "” wilt verwijderen? Dit kan niet ongedaan worden gemaakt."}
        </p>
      </ConfirmDialog>
    </div>
  );
}
