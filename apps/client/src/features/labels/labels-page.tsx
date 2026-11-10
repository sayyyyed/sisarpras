import { useMemo, useState, type ReactElement } from "react";
import { RiPrinterLine } from "@remixicon/react";
import { CONDITION_LABEL } from "@sisarpras/domain";
import { Button } from "@/components/base/buttons/button";
import { Divider } from "@/components/base/divider/divider";
import { FileUpload } from "@/components/base/file-upload/file-upload";
import { Input } from "@/components/base/input/input";
import { NumberField } from "@/components/base/number-field/number-field";
import { Select, SelectItem } from "@/components/base/select/select";
import { PageHeading, Panel, SectionHeading } from "@/components/ui/primitives";
import { formatDate } from "@/lib/format";
import { activeAssets } from "@/lib/inventory";
import { useApp } from "@/lib/store";
import { useCompanyProfile } from "@/lib/company";

/** Deterministic decorative QR block — a real encoder ships with the QR feature. */
function PreviewCode({ seed }: { seed: string }) {
  const modules = 11;
  const cell = 100 / modules;

  const shapes = useMemo(() => {
    let state = 2166136261;
    for (let index = 0; index < seed.length; index += 1) {
      state ^= seed.charCodeAt(index);
      state = Math.imul(state, 16777619);
    }
    state = Math.abs(state) || 1;
    const next = () => {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      return state / 0x7fffffff;
    };
    const inFinder = (x: number, y: number) =>
      (x < 3 && y < 3) || (x > modules - 4 && y < 3) || (x < 3 && y > modules - 4);

    const output: ReactElement[] = [];
    for (let y = 0; y < modules; y += 1) {
      for (let x = 0; x < modules; x += 1) {
        if (inFinder(x, y)) continue;
        if (next() > 0.52) {
          output.push(
            <rect key={`m-${x}-${y}`} x={x * cell} y={y * cell} width={cell} height={cell} fill="#101828" />,
          );
        }
      }
    }
    for (const [fx, fy] of [
      [0, 0],
      [modules - 3, 0],
      [0, modules - 3],
    ]) {
      output.push(
        <rect
          key={`f-${fx}-${fy}`}
          x={fx * cell}
          y={fy * cell}
          width={3 * cell}
          height={3 * cell}
          fill="none"
          stroke="#101828"
          strokeWidth={cell * 0.9}
        />,
      );
    }
    return output;
  }, [seed]);

  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" role="img" aria-label={`Kode ${seed}`}>
      {shapes}
    </svg>
  );
}

export default function LabelsPage() {
  const { assets, categories, locations } = useApp();
  const company = useCompanyProfile();
  const list = activeAssets(assets);
  const categoryName = useMemo(() => new Map(categories.map((item) => [item.id, item.name])), [categories]);
  const locationName = useMemo(() => new Map(locations.map((item) => [item.id, item.name])), [locations]);

  const [selectedId, setSelectedId] = useState(() => list[0]?.id ?? "");
  const [prefix, setPrefix] = useState("");
  const [codeKind, setCodeKind] = useState<string | null>("qr");
  const [logoLabel, setLogoLabel] = useState("");

  const selected = list.find((asset) => asset.id === selectedId) ?? list[0];
  const selectedPrefix = selected ? `${selected.assetCode.split("-").slice(0, -1).join("-")}-` : "";
  const effectivePrefix = prefix || selectedPrefix;
  const effectiveLogoLabel = logoLabel || company.name.slice(0, 2).toUpperCase();

  const previewCode = useMemo(() => {
    if (!selected) return "";
    const suffix = selected.assetCode.split("-").slice(-1)[0];
    return `${effectivePrefix}${suffix}`;
  }, [effectivePrefix, selected]);

  return (
    <>
      <PageHeading
        title="Label & Barcode"
        subtitle="Stiker inventaris dengan logo dan kode kustom — siap cetak, juga saat offline"
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel padded>
          <SectionHeading title="Pengaturan Stiker" subtitle="Berlaku untuk semua label di batch ini" />

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Input label="Prefix kode" value={effectivePrefix} onChange={setPrefix} hint="Nomor mengikuti aset terpilih" />
            <Select
              label="Jenis kode"
              selectedKey={codeKind}
              onSelectionChange={(key) => setCodeKind(key === null ? null : String(key))}
            >
              <SelectItem id="qr">QR Code</SelectItem>
              <SelectItem id="barcode">Barcode (Code 128)</SelectItem>
            </Select>
            <Select label="Ukuran label" defaultSelectedKey="62x38">
              <SelectItem id="62x38">62 × 38 mm (standar)</SelectItem>
              <SelectItem id="50x30">50 × 30 mm</SelectItem>
              <SelectItem id="100x50">100 × 50 mm</SelectItem>
            </Select>
            <NumberField label="Jumlah salinan" defaultValue={1} minValue={1} maxValue={50} />
            <Input label="Teks logo" value={effectiveLogoLabel} onChange={(value) => setLogoLabel(value.toUpperCase())} maxLength={3} />
            <Input label="Penanggung jawab (opsional)" placeholder="cth. Bagian Umum" />
          </div>

          <Divider className="my-6" />

          <SectionHeading title="Logo Instansi" subtitle="PNG transparan disarankan" />
          <div className="mt-4">
            <FileUpload allowedExtensions={["png", "svg", "jpg"]} maxBytes={2 * 1024 * 1024} />
          </div>

          <Divider className="my-6" />

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled>Pratinjau lembar A4 (belum tersedia)</Button>
            <Button leadingIcon={RiPrinterLine} disabled>
              Cetak Stiker (belum tersedia)
            </Button>
          </div>
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel padded>
            <SectionHeading title="Pratinjau" />

            {selected ? (
              <div className="mt-4 flex items-center gap-3.5 rounded-2xl border border-[#d0d5dd] bg-white p-3.5 text-[#101828]">
                <div className="h-[86px] w-[86px] flex-none rounded-lg border border-[#e4e7ec] bg-white p-1.5">
                  <PreviewCode seed={previewCode} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="grid size-[22px] place-items-center rounded-md bg-accent-600 text-[9px] font-bold text-white">
                    {effectiveLogoLabel}
                  </div>
                  <div className="mt-1.5 truncate text-[15px] font-bold tracking-tight">{selected.name}</div>
                  <div className="mt-1 font-mono text-[17px] font-bold tracking-wide">{previewCode}</div>
                  <div className="mt-1 text-[10.5px] leading-relaxed text-[#475467]">
                    {locationName.get(selected.locationId ?? "") ?? "—"} · {categoryName.get(selected.categoryId) ?? "—"}
                    <br />
                    Kondisi: {CONDITION_LABEL[selected.condition]} · Perolehan: {formatDate(selected.acquisitionDate)}
                  </div>
                  <div className="mt-2 border-t border-[#e4e7ec] pt-1.5 text-[9.5px] uppercase tracking-wider text-[#667085]">
                    Inventaris dinas — jangan dipindahkan tanpa izin
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-4 rounded-2xl border border-dashed border-border-button-default p-6 text-center text-caption-1-regular text-text-tertiary">
                Belum ada aset aktif untuk dicetak.
              </p>
            )}

            <p className="mt-3 text-caption-1-regular text-text-tertiary">
              Stiker memakai kode lokal, jadi tetap valid saat perangkat offline.
            </p>
          </Panel>

          <Panel padded>
            <SectionHeading title="Pilih Aset" />
            <div className="mt-3 flex max-h-[320px] flex-col gap-1 overflow-y-auto">
              {list.map((asset) => {
                const isSelected = asset.id === selected?.id;
                return (
                  <Button
                    key={asset.id}
                    variant={isSelected ? "secondary" : "ghost"}
                    className="justify-between gap-3"
                    onClick={() => setSelectedId(asset.id)}
                  >
                    <span className="truncate">{asset.name}</span>
                    <span className="shrink-0 font-mono text-caption-1-regular text-text-tertiary">{asset.assetCode}</span>
                  </Button>
                );
              })}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
