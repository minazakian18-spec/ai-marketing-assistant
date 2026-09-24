"use client";
import { useState } from "react";
import { Plus, Pencil, Trash2, Package, Image as ImageIcon } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { ConfirmDialog } from "@/components/account/confirm-dialog";
import { ProductFormDialog } from "./product-form-dialog";
import type { Product } from "@/lib/brand-model";

export function ProductsManager() {
  const { data, ready, save } = useWorkspace();
  const products = data.profile.productList || [];
  const [editing, setEditing] = useState<Product | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [message, setMessage] = useState("");

  function persist(next: Product[], text: string) {
    if (save({ ...data, profile: { ...data.profile, productList: next } }))
      setMessage(text);
  }

  return (
    <section className="panel brand-section">
      <div className="section-heading">
        <div>
          <h2>Producten & diensten</h2>
          <p>
            Elk product wordt herbruikbare context voor Instagram AI, Email AI
            en de Contentkalender.
          </p>
        </div>
        <Package size={22} />
      </div>
      {ready && products.length > 0 && (
        <div className="brand-card-grid">
          {products.map((p) => (
            <article key={p.id} className="panel brand-card">
              <div className="brand-card-head">
                <div className="brand-card-title">
                  {p.photo ? (
                    <img src={p.photo} alt="" className="brand-card-thumb" />
                  ) : (
                    <span className="brand-card-thumb brand-card-thumb-placeholder">
                      <ImageIcon size={16} />
                    </span>
                  )}
                  <div>
                    <h3>{p.name}</h3>
                    {p.category && (
                      <span className="lib-type-tag">{p.category}</span>
                    )}
                  </div>
                </div>
                <div className="brand-card-actions">
                  <button
                    type="button"
                    aria-label={"Bewerk " + p.name}
                    onClick={() => {
                      setEditing(p);
                      setFormOpen(true);
                    }}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    aria-label={"Verwijder " + p.name}
                    onClick={() => setDeleteTarget(p)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              {p.price && <p className="brand-card-meta">{p.price}</p>}
              {p.description && <p>{p.description}</p>}
              {!p.active && <span className="badge draft">Inactief</span>}
            </article>
          ))}
        </div>
      )}
      {ready && products.length === 0 && (
        <p className="field-note">
          Nog geen producten toegevoegd. Voeg ze handmatig toe, of gebruik
          Website-import hieronder om te beginnen vanaf je website.
        </p>
      )}
      <div className="ig-settings-footer">
        <p role="status">{message}</p>
        <button
          type="button"
          className="button primary"
          disabled={!ready}
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus size={16} />
          Product toevoegen
        </button>
      </div>
      <ProductFormDialog
        open={formOpen}
        product={editing}
        onClose={() => setFormOpen(false)}
        onSave={(product) => {
          const exists = products.some((p) => p.id === product.id);
          persist(
            exists
              ? products.map((p) => (p.id === product.id ? product : p))
              : [...products, product],
            exists ? "Product bijgewerkt." : "Product toegevoegd.",
          );
          setFormOpen(false);
        }}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Product verwijderen?"
        confirmLabel="Verwijderen"
        danger
        onConfirm={() => {
          if (!deleteTarget) return;
          persist(
            products.filter((p) => p.id !== deleteTarget.id),
            "'" + deleteTarget.name + "' is verwijderd.",
          );
          setDeleteTarget(null);
        }}
      >
        <p>
          Weet je zeker dat je "{deleteTarget?.name}" wilt verwijderen? Dit kan
          niet ongedaan worden gemaakt.
        </p>
      </ConfirmDialog>
    </section>
  );
}
