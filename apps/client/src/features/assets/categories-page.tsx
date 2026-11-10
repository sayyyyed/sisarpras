import { useEffect, useState } from "react";
import { RiArrowLeftLine, RiCheckLine, RiPriceTag3Line } from "@remixicon/react";
import { useNavigate } from "react-router-dom";
import type { Category } from "@sisarpras/domain";
import { Chip } from "@/components/base/badges/chip";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Switch } from "@/components/base/switch/switch";
import { PageHeading, Panel, SectionHeading } from "@/components/ui/primitives";
import { useApp } from "@/lib/store";

export default function CategoriesPage() {
  const { categories, createCategory, updateCategory, reload, showToast } = useApp();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function addCategory() {
    setError("");
    if (!code.trim() || !name.trim()) return setError("Kode dan nama kategori wajib diisi.");
    setSaving(true);
    try {
      const result = await createCategory({ code: code.trim(), name: name.trim() });
      if (!result.ok) return setError(result.error === "category_code_taken" ? "Kode kategori sudah digunakan." : result.error ?? "Gagal menambahkan kategori.");
      await reload();
      showToast("Kategori ditambahkan", name.trim());
      setCode("");
      setName("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeading
        title="Kategori Aset"
        subtitle={`${categories.length} kategori · kategori nonaktif disembunyikan dari form aset baru`}
        actions={<Button variant="ghost" leadingIcon={RiArrowLeftLine} onClick={() => navigate("/assets")}>Kembali ke Aset</Button>}
      />

      <Panel padded>
        <SectionHeading title="Tambah Kategori" subtitle="Kode kategori digunakan sebagai identitas unik." />
        <div className="mt-4 grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:items-end">
          <Input label="Kode kategori *" placeholder="cth. ELK" value={code} onChange={setCode} maxLength={20} />
          <Input label="Nama kategori *" placeholder="cth. Elektronik" value={name} onChange={setName} maxLength={255} />
          <Button leadingIcon={RiPriceTag3Line} onClick={addCategory} disabled={saving}>
            {saving ? "Menyimpan…" : "Tambah Kategori"}
          </Button>
        </div>
        {error && <p className="mt-3 text-caption-1-regular text-text-error-primary">{error}</p>}
      </Panel>

      <Panel padded>
        <SectionHeading title="Daftar Kategori" subtitle="Edit nama atau atur pemakaian kategori pada form aset." />
        {categories.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-border-button-default p-6 text-center text-body-regular text-text-tertiary">Belum ada kategori.</p>
        ) : (
          <div className="mt-4 flex flex-col divide-y divide-separator-border">
            {categories.map((category) => (
              <CategoryRow key={category.id} category={category} updateCategory={updateCategory} showToast={showToast} />
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}

function CategoryRow({
  category,
  updateCategory,
  showToast,
}: {
  category: Category;
  updateCategory: (id: string, patch: { name?: string; active?: boolean }) => Promise<{ ok: boolean; error?: string }>;
  showToast: (message: string, description?: string) => void;
}) {
  const [name, setName] = useState(category.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const active = category.active !== false;

  useEffect(() => setName(category.name), [category.name]);

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed) return setError("Nama kategori wajib diisi.");
    if (trimmed === category.name) return;
    setSaving(true);
    setError("");
    try {
      const result = await updateCategory(category.id, { name: trimmed });
      if (!result.ok) return setError(result.error ?? "Gagal memperbarui nama kategori.");
      showToast("Nama kategori diperbarui", trimmed);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(next: boolean) {
    setSaving(true);
    setError("");
    try {
      const result = await updateCategory(category.id, { active: next });
      if (!result.ok) return setError(result.error ?? "Gagal mengubah status kategori.");
      showToast(next ? "Kategori diaktifkan" : "Kategori dinonaktifkan", category.name);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(180px,1.4fr)_auto] sm:items-center">
      <div className="flex items-center gap-2">
        <Chip variant="caption" color="neutral">{category.code}</Chip>
        <Chip variant="caption" color={active ? "lime" : "neutral"}>{active ? "Aktif" : "Nonaktif"}</Chip>
      </div>
      <Input aria-label={`Nama kategori ${category.code}`} value={name} onChange={setName} maxLength={255} />
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <Button size="small" variant="secondary" leadingIcon={RiCheckLine} disabled={saving || name.trim() === category.name} onClick={saveName}>Simpan Nama</Button>
        <Switch isSelected={active} onChange={toggleActive} aria-label={`${active ? "Nonaktifkan" : "Aktifkan"} kategori ${category.name}`} isDisabled={saving} />
      </div>
      {error && <p className="text-caption-1-regular text-text-error-primary sm:col-span-3">{error}</p>}
    </div>
  );
}
