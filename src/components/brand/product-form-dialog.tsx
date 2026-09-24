"use client";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/account/confirm-dialog";
import { readImages } from "@/lib/local-images";
import type { Product } from "@/lib/brand-model";

export function ProductFormDialog({
  open,
  product,
  onClose,
  onSave,
}: {
  open: boolean;
  product?: Product | null;
  onClose: () => void;
  onSave: (product: Product) => void;
}) {
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [url, setUrl] = useState("");
  const [features, setFeatures] = useState("");
  const [targetCustomer, setTargetCustomer] = useState("");
  const [active, setActive] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setName(product?.name || "");
    setPhoto(product?.photo || "");
    setDescription(product?.description || "");
    setCategory(product?.category || "");
    setPrice(product?.price || "");
    setUrl(product?.url || "");
    setFeatures(product?.features || "");
    setTargetCustomer(product?.targetCustomer || "");
    setActive(product?.active ?? true);
    setError("");
  }, [open, product]);
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      title={product ? "Product bewerken" : "Product toevoegen"}
      confirmLabel={product ? "Wijzigingen opslaan" : "Product toevoegen"}
      onConfirm={() => {
        if (!name.trim()) {
          setError("Geef het product of de dienst een naam.");
          return;
        }
        if (url.trim() && !/^https?:\/\//i.test(url.trim())) {
          setError("Gebruik een volledige link (http:// of https://).");
          return;
        }
        onSave({
          id: product?.id || crypto.randomUUID(),
          name: name.trim(),
          photo: photo || undefined,
          description: description.trim(),
          category: category.trim(),
          price: price.trim(),
          url: url.trim(),
          features: features.trim(),
          targetCustomer: targetCustomer.trim(),
          active,
          source: product?.source || "manual",
        });
      }}
    >
      <div className="ig-two-fields">
        <label>
          Productnaam
          <input
            value={name}
            maxLength={120}
            placeholder="Bijvoorbeeld: Zomercollectie tas"
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
          />
        </label>
        <label>
          Categorie
          <input
            value={category}
            maxLength={80}
            placeholder="Bijvoorbeeld: Tassen"
            onChange={(e) => setCategory(e.target.value)}
          />
        </label>
      </div>
      {error && <p className="field-error">{error}</p>}
      <label>
        Omschrijving
        <textarea
          value={description}
          rows={3}
          maxLength={1000}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <div className="ig-two-fields">
        <label>
          Prijs
          <input
            value={price}
            maxLength={60}
            placeholder="Bijvoorbeeld: €49,95"
            onChange={(e) => setPrice(e.target.value)}
          />
        </label>
        <label>
          Website-URL
          <input
            value={url}
            maxLength={300}
            placeholder="https://jouwbedrijf.nl/product"
            onChange={(e) => {
              setUrl(e.target.value);
              setError("");
            }}
          />
        </label>
      </div>
      <label>
        Belangrijkste kenmerken
        <textarea
          value={features}
          rows={2}
          maxLength={500}
          placeholder="Wat maakt dit product bijzonder?"
          onChange={(e) => setFeatures(e.target.value)}
        />
      </label>
      <label>
        Doelklant
        <input
          value={targetCustomer}
          maxLength={200}
          placeholder="Voor wie is dit vooral bedoeld?"
          onChange={(e) => setTargetCustomer(e.target.value)}
        />
      </label>
      <label>
        Productfoto
        <input
          type="file"
          disabled={busy}
          accept="image/png,image/jpeg,image/webp"
          onChange={async (e) => {
            const files = Array.from(e.target.files || []);
            e.target.value = "";
            if (!files.length) return;
            setBusy(true);
            try {
              const [next] = await readImages(files, 1);
              setPhoto(next);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Foto uploaden is niet gelukt.");
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      {photo && (
        <div className="ig-brand-logo">
          <img src={photo} alt="" />
          <button type="button" onClick={() => setPhoto("")}>
            Foto verwijderen
          </button>
        </div>
      )}
      <label className="ig-toggle-row">
        <div>
          <strong>Actief</strong>
          <small>Alleen actieve producten worden aan Mavix AI voorgesteld.</small>
        </div>
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />
      </label>
    </ConfirmDialog>
  );
}
