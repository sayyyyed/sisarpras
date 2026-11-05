import { useEffect, useState } from "react";
import { RiArrowLeftLine, RiCheckLine } from "@remixicon/react";
import { useNavigate } from "react-router-dom";
import type { CalendarDate } from "@internationalized/date";
import { AssetDraftSchema, type AssetCondition, type AssetStatus } from "@sisarpras/domain";
import { Chip } from "@/components/base/badges/chip";
import { Button } from "@/components/base/buttons/button";
import { DatePicker } from "@/components/base/date-picker/date-picker";
import { Divider } from "@/components/base/divider/divider";
import { FileUpload } from "@/components/base/file-upload/file-upload";
import { Input } from "@/components/base/input/input";
import { Label } from "@/components/base/input/label";
import { NumberField } from "@/components/base/number-field/number-field";
import { RadioCard } from "@/components/base/radio/radio-card";
import { RadioGroup } from "@/components/base/radio/radio";
import { Select, SelectItem } from "@/components/base/select/select";
import { Switch } from "@/components/base/switch/switch";
import { Textarea } from "@/components/base/textarea/textarea";
import { LabelledRow, PageHeading, Panel, SectionHeading } from "@/components/ui/primitives";
import { toast } from "@/components/base/toast/toast";
import { nextAssetCode } from "@/lib/inventory";
import { useApp } from "@/lib/store";

const CONDITION_OPTIONS: { value: AssetCondition; title: string; description: string }[] = [
  { value: "good", title: "Baik", description: "Siap pakai" },
  { value: "fair", title: "Cukup", description: "Ada tanda pemakaian" },
  { value: "damaged", title: "Rusak", description: "Perlu perbaikan" },
];

const STATUS_OPTIONS: { value: AssetStatus; label: string }[] = [
  { value: "available", label: "Tersedia" },
  { value: "assigned", label: "Ditugaskan" },
  { value: "maintenance", label: "Perbaikan" },
  { value: "disposed", label: "Dihapus" },
];

export default function AssetFormPage() {
  const { assets, categories, locations, loading, createAsset, showToast } = useApp();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [assetCode, setAssetCode] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [condition, setCondition] = useState<AssetCondition>("good");
  const [status, setStatus] = useState<AssetStatus>("available");
  const [serialNumber, setSerialNumber] = useState("");
  const [purchaseDate, setPurchaseDate] = useState<CalendarDate | null>(null);
  const [cost, setCost] = useState<number | undefined>(undefined);
  const [description, setDescription] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const categoryName = categories.find((item) => item.id === categoryId)?.name ?? "—";
  const locationName = locations.find((item) => item.id === locationId)?.name ?? "—";

  // The code needs the existing assets, which arrive asynchronously — wait for
  // the load instead of freezing "AST-…-0001" on first render.
  useEffect(() => {
    if (!assetCode && !loading) setAssetCode(nextAssetCode(assets));
  }, [assetCode, loading, assets]);

  function resetForNext() {
    setName("");
    setSerialNumber("");
    setDescription("");
    setCost(undefined);
    setPurchaseDate(null);
    setCategoryId(null);
    setLocationId(null);
    setCondition("good");
    setStatus("available");
    setAssetCode(nextAssetCode(assets));
    setErrors({});
  }

  async function submit(addAnother: boolean) {
    const result = AssetDraftSchema.safeParse({
      assetCode: assetCode.trim(),
      name: name.trim(),
      categoryId: categoryId ?? "",
      locationId: locationId ?? "",
      serialNumber: serialNumber.trim() || null,
      description: description.trim() || null,
      condition,
      status,
      acquisitionDate: purchaseDate ? purchaseDate.toString() : null,
      acquisitionCostIdr: cost ?? null,
    });

    if (!result.success) {
      const next: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      const outcome = await createAsset(result.data);
      if (!outcome.ok) {
        toast.error("Gagal menyimpan aset", {
          description: outcome.error ?? "Server menolak data. Periksa kembali isian.",
        });
        return;
      }
      showToast(
        outcome.queued ? "Tersimpan di perangkat" : "Aset tersimpan di server",
        outcome.queued
          ? "Server belum terjangkau — akan disinkronkan nanti"
          : "Data sudah masuk PostgreSQL",
      );
      if (addAnother) resetForNext();
      else navigate("/assets");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeading
        title="Tambah Aset"
        subtitle="Tersimpan lokal lebih dulu, tersinkron otomatis saat online"
        actions={
          <Button variant="ghost" leadingIcon={RiArrowLeftLine} onClick={() => navigate("/assets")}>
            Kembali ke daftar
          </Button>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Panel padded>
          <SectionHeading title="Informasi Aset" subtitle="Field bertanda * wajib diisi" />

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Input
              label="Nama Aset *"
              placeholder="cth. Laptop Dell Latitude 5440"
              value={name}
              onChange={setName}
              isInvalid={Boolean(errors.name)}
              errorMessage={errors.name}
            />
            <Input
              label="Kode Aset *"
              value={assetCode}
              onChange={setAssetCode}
              hint="Diperiksa lokal, divalidasi ulang saat sinkronisasi"
              isInvalid={Boolean(errors.assetCode)}
              errorMessage={errors.assetCode}
            />
            <Select
              label="Kategori *"
              placeholder="Pilih kategori…"
              selectedKey={categoryId}
              onSelectionChange={(key) => setCategoryId(key === null ? null : String(key))}
            >
              {categories.map((item) => (
                <SelectItem key={item.id} id={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </Select>
            <Select
              label="Ruangan *"
              placeholder="Pilih ruangan…"
              selectedKey={locationId}
              onSelectionChange={(key) => setLocationId(key === null ? null : String(key))}
            >
              {locations
                .filter((item) => item.kind === "room" || item.kind === "storage")
                .map((item) => (
                  <SelectItem key={item.id} id={item.id}>
                    {item.name} — {item.building}
                  </SelectItem>
                ))}
            </Select>
          </div>

          <div className="mt-5">
            <RadioGroup
              aria-label="Kondisi aset"
              value={condition}
              onChange={(value) => setCondition(value as AssetCondition)}
            >
              <div className="grid gap-3 sm:grid-cols-3">
                {CONDITION_OPTIONS.map((option) => (
                  <RadioCard
                    key={option.value}
                    value={option.value}
                    title={option.title}
                    description={option.description}
                  />
                ))}
              </div>
            </RadioGroup>
          </div>

          <div className="mt-5">
            <Select
              label="Status"
              selectedKey={status}
              onSelectionChange={(key) => setStatus(String(key) as AssetStatus)}
            >
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} id={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </Select>
          </div>

          <Divider className="my-6" />

          <SectionHeading title="Informasi Tambahan" />

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Input label="Nomor Seri" placeholder="cth. SN-88213004" value={serialNumber} onChange={setSerialNumber} />
            <div className="flex flex-col gap-1.5">
              <Label>Tanggal Perolehan</Label>
              <DatePicker aria-label="Tanggal perolehan" value={purchaseDate} onChange={setPurchaseDate} />
            </div>
            <NumberField
              label="Harga Perolehan (Rp)"
              hint="Bilangan bulat rupiah — tanpa desimal"
              value={cost}
              onChange={(value) => setCost(Number.isNaN(value) ? undefined : value)}
              minValue={0}
            />
            <Input label="Nomor Pengadaan (opsional)" placeholder="cth. PR-2026-021" />
          </div>

          <div className="mt-5">
            <Textarea
              label="Catatan"
              rows={3}
              placeholder="Keterangan tambahan, kondisi awal, kelengkapan…"
              value={description}
              onChange={setDescription}
              maxLength={500}
              showCount
            />
          </div>

          <div className="mt-5">
            <span className="text-body-medium text-text-primary">Berkas Aset</span>
            <p className="mb-3 mt-0.5 text-caption-1-regular text-text-tertiary">
              Foto aset, nota pembelian, atau berita acara serah terima
            </p>
            <FileUpload
              allowedExtensions={["pdf", "jpg", "jpeg", "png"]}
              maxBytes={10 * 1024 * 1024}
              onUploadComplete={(file) => showToast("Berkas siap disimpan", file.name)}
            />
          </div>

          <Divider className="my-6" />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Switch isSelected={needsVerification} onChange={setNeedsVerification}>
              Perlu verifikasi berkala
            </Switch>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => navigate("/assets")}>
                Batal
              </Button>
              <Button variant="secondary" onClick={() => submit(true)} disabled={saving}>
                Simpan &amp; Tambah Lagi
              </Button>
              <Button leadingIcon={RiCheckLine} onClick={() => submit(false)} disabled={saving}>
                {saving ? "Menyimpan…" : "Simpan Aset"}
              </Button>
            </div>
          </div>
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel padded>
            <SectionHeading title="Status Penyimpanan" />
            <div className="mt-3 flex items-start gap-3">
              <Chip variant="caption" color="yellow">
                mode lokal
              </Chip>
            </div>
            <p className="mt-3 text-body-regular text-text-secondary">
              Perubahan disimpan ke SQLite lokal dan dimasukkan ke antrean sinkronisasi. Form tidak dikosongkan otomatis
              jika penyimpanan gagal.
            </p>
          </Panel>

          <Panel padded>
            <SectionHeading title="Ringkasan" />
            <div className="mt-3 flex flex-col gap-2">
              <LabelledRow label="Kategori">{categoryName}</LabelledRow>
              <LabelledRow label="Ruangan">{locationName}</LabelledRow>
              <LabelledRow label="Kondisi">
                {CONDITION_OPTIONS.find((option) => option.value === condition)?.title ?? "—"}
              </LabelledRow>
              <LabelledRow label="Status">
                {STATUS_OPTIONS.find((option) => option.value === status)?.label ?? "—"}
              </LabelledRow>
              <LabelledRow label="Verifikasi berkala">{needsVerification ? "Ya" : "Tidak"}</LabelledRow>
            </div>
          </Panel>

          <Panel padded className="bg-accent-50">
            <div className="text-body-medium text-accent-700">Penyimpanan transaksional</div>
            <p className="mt-1.5 text-caption-1-regular text-accent-700">
              Data aset dan entri antrean sinkronisasi ditulis dalam satu transaksi SQLite — keduanya berhasil atau
              keduanya batal.
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}
