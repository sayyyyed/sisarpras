import { useEffect, useState } from "react";
import { RiArrowLeftLine, RiCheckLine } from "@remixicon/react";
import { useNavigate, useParams } from "react-router-dom";
import { AssetDraftSchema } from "@sisarpras/domain";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { NumberField } from "@/components/base/number-field/number-field";
import { Select, SelectItem } from "@/components/base/select/select";
import { Textarea } from "@/components/base/textarea/textarea";
import { PageHeading, Panel, SectionHeading } from "@/components/ui/primitives";
import { nextAssetCode } from "@/lib/inventory";
import { useApp } from "@/lib/store";

export default function AssetFormPage() {
  const { assetId } = useParams();
  const { assets, categories, locations, loading, createAsset, updateAsset, showToast } = useApp();
  const navigate = useNavigate();
  const asset = assetId ? assets.find((item) => item.id === assetId) : undefined;
  const editing = Boolean(assetId);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [stockQuantity, setStockQuantity] = useState(0);
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (editing && asset && !initialized) {
      setName(asset.name);
      setCategoryId(asset.categoryId);
      setLocationId(asset.locationId);
      setStockQuantity(asset.stockQuantity);
      setDescription(asset.description ?? "");
      setInitialized(true);
    }
  }, [asset, editing, initialized]);

  if (editing && !asset && !loading) {
    return <Panel padded><p className="text-body-regular text-text-secondary">Barang tidak ditemukan.</p><Button className="mt-4" variant="secondary" onClick={() => navigate("/assets")}>Kembali ke Aset</Button></Panel>;
  }

  async function submit() {
    const payload = {
      assetCode: asset?.assetCode ?? nextAssetCode(assets),
      name: name.trim(),
      categoryId: categoryId ?? "",
      locationId,
      stockQuantity,
      roomStocks: !editing && locationId && stockQuantity > 0 ? [{ locationId, quantity: stockQuantity }] : editing ? asset?.roomStocks ?? [] : [],
      serialNumber: asset?.serialNumber ?? null,
      description: description.trim() || null,
      condition: asset?.condition ?? "good",
      status: asset?.status ?? "available",
      acquisitionDate: asset?.acquisitionDate ?? null,
      acquisitionCostIdr: asset?.acquisitionCostIdr ?? null,
    };

    const parsed = AssetDraftSchema.safeParse(payload);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      const result = editing && asset
        ? await updateAsset(asset.id, { name: parsed.data.name, categoryId: parsed.data.categoryId, description: parsed.data.description })
        : await createAsset(parsed.data);
      if (!result.ok) {
        setErrors({ form: result.error ?? "Gagal menyimpan barang." });
        return;
      }
      showToast(editing ? "Barang diperbarui" : result.queued ? "Tersimpan di perangkat" : "Barang ditambahkan", name);
      navigate("/assets");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeading
        title={editing ? "Edit Barang" : "Tambah Barang"}
        actions={<Button variant="ghost" leadingIcon={RiArrowLeftLine} onClick={() => navigate("/assets")}>Kembali ke Aset</Button>}
      />
      <Panel padded className="max-w-3xl">
        <SectionHeading title="Informasi Barang" />
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Input label="Nama barang *" placeholder="cth. Foto Prabowo" value={name} onChange={setName} isInvalid={Boolean(errors.name)} errorMessage={errors.name} />
          <Select label="Kategori *" placeholder="Pilih kategori" selectedKey={categoryId} onSelectionChange={(key) => setCategoryId(key === null ? null : String(key))}>
            {categories.filter((item) => item.active !== false).map((item) => <SelectItem key={item.id} id={item.id}>{item.name}</SelectItem>)}
          </Select>
          {!editing && <NumberField label="Stok awal" value={stockQuantity} onChange={(value) => setStockQuantity(Number.isNaN(value) ? 0 : value)} minValue={0} />}
          {!editing && <Select
            label="Ruangan (opsional)"
            selectedKey={locationId ?? "none"}
            onSelectionChange={(key) => setLocationId(key === null || key === "none" ? null : String(key))}
          >
            <SelectItem id="none">Belum ditempatkan</SelectItem>
            {locations.filter((item) => item.kind === "room" || item.kind === "storage").map((item) => <SelectItem key={item.id} id={item.id}>{item.name}</SelectItem>)}
          </Select>}
        </div>
        <div className="mt-5"><Textarea label="Catatan" rows={3} value={description} onChange={setDescription} maxLength={500} showCount /></div>
        {errors.form && <p className="mt-4 text-caption-1-regular text-text-error-primary">{errors.form}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => navigate("/assets")}>Batal</Button>
          <Button leadingIcon={RiCheckLine} disabled={saving || (editing && !asset)} onClick={() => void submit()}>{saving ? "Menyimpan…" : editing ? "Simpan" : "Tambah barang"}</Button>
        </div>
      </Panel>
    </>
  );
}
