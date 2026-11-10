import { useCallback, useEffect, useRef, useState } from "react";
import { RiAddLine, RiArrowLeftLine, RiDeleteBinLine, RiSubtractLine } from "@remixicon/react";
import { useNavigate, useParams } from "react-router-dom";
import type { Asset } from "@sisarpras/domain";
import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { FileUpload } from "@/components/base/file-upload/file-upload";
import { Modal, ModalBody, ModalDialog, ModalFooter, ModalHeader } from "@/components/base/modal/modal";
import { SearchField } from "@/components/base/search-field/search-field";
import { Switch } from "@/components/base/switch/switch";
import { PageHeading, Panel, SectionHeading } from "@/components/ui/primitives";
import { AssetPhotoControl, assetRoomPhotoOwnerId } from "@/features/assets/asset-photo-control";
import { attachmentUrl, deleteAttachment, listAttachments, saveAttachment, type AttachmentOwner, type LocalAttachment } from "@/lib/local-attachments";
import { useApp } from "@/lib/store";

export default function RoomDetailPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { assets, categories, locations, loading, setAssetRoomStock, updateLocation, showToast } = useApp();
  const [addAssetsOpen, setAddAssetsOpen] = useState(false);
  const room = locations.find((item) => item.id === roomId && (item.kind === "room" || item.kind === "storage"));
  const roomAssets = assets.flatMap((asset) => {
    const allocation = asset.roomStocks.find((item) => item.locationId === roomId);
    return allocation ? [{ asset, quantity: allocation.quantity }] : [];
  });
  const roomUsed = roomAssets.reduce((total, item) => total + item.quantity, 0);
  const [error, setError] = useState("");

  if (!room && !loading) {
    return <Panel padded><p className="text-body-regular text-text-secondary">Ruangan tidak ditemukan.</p><Button className="mt-4" variant="secondary" onClick={() => navigate("/rooms")}>Kembali ke Ruangan</Button></Panel>;
  }
  if (!room) return <Panel padded><p className="text-body-regular text-text-secondary">Memuat ruangan…</p></Panel>;
  const currentRoom = room;

  async function toggleActive(active: boolean) {
    const result = await updateLocation(currentRoom.id, { active });
    setError(result.ok ? "" : result.error ?? "Gagal mengubah status ruang.");
    if (result.ok) showToast(active ? "Ruang diaktifkan" : "Ruang dinonaktifkan", currentRoom.name);
  }

  return (
    <>
      <PageHeading
        title={room.name}
        subtitle={`${room.building ?? "Gedung belum diset"} · ${room.floor ?? "Lantai belum diset"} · Kapasitas ${room.capacity ?? "—"}`}
        actions={<Button variant="ghost" leadingIcon={RiArrowLeftLine} onClick={() => navigate("/rooms")}>Kembali ke Ruangan</Button>}
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-6">
          <Panel padded>
            <SectionHeading
              title="Aset di Ruang Ini"
              subtitle={`${roomUsed} unit digunakan`}
              actions={<Button size="small" leadingIcon={RiAddLine} onClick={() => setAddAssetsOpen(true)}>Tambah aset</Button>}
            />
            {roomAssets.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-border-button-default p-6 text-center text-body-regular text-text-tertiary">Belum ada aset di ruangan ini.</p>
            ) : (
              <div className="mt-4 flex flex-col gap-4">
                {roomAssets.map(({ asset, quantity }) => <AssetRoomCard key={asset.id} asset={asset} roomId={room.id} roomName={room.name} quantity={quantity} setAssetRoomStock={setAssetRoomStock} />)}
              </div>
            )}
          </Panel>

          <Panel padded>
            <SectionHeading title="Foto Ruang" subtitle="Unggah beberapa foto ruang. File disimpan di perangkat ini." />
            <div className="mt-4">
              <AttachmentGallery ownerType="location" ownerId={room.id} />
            </div>
          </Panel>
        </div>

        <Panel padded>
          <SectionHeading title="Status Ruang" />
          <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-border-button-default p-3">
            <div>
              <div className="text-body-medium text-text-primary">{room.active === false ? "Ruang nonaktif" : "Ruang aktif"}</div>
              <div className="text-caption-1-regular text-text-tertiary">Nonaktif hanya mengubah aksen tampilan ruang.</div>
            </div>
            <Switch isSelected={room.active !== false} onChange={toggleActive} aria-label="Aktifkan ruang" />
          </div>
          {error && <p className="mt-3 text-caption-1-regular text-text-error-primary">{error}</p>}
        </Panel>
      </div>
      <AddAssetsModal
        isOpen={addAssetsOpen}
        onOpenChange={setAddAssetsOpen}
        room={currentRoom}
        assets={assets}
        categories={categories}
        setAssetRoomStock={setAssetRoomStock}
        onAdded={(count) => showToast(`${count} unit ditambahkan ke ruangan`, currentRoom.name)}
      />
    </>
  );
}

function AddAssetsModal({
  isOpen,
  onOpenChange,
  room,
  assets,
  categories,
  setAssetRoomStock,
  onAdded,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  room: { id: string; name: string };
  assets: Asset[];
  categories: { id: string; name: string }[];
  setAssetRoomStock: (id: string, locationId: string, input: { quantity: number }) => Promise<{ ok: boolean; error?: string }>;
  onAdded: (count: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const categoryName = new Map(categories.map((item) => [item.id, item.name]));
  const available = assets.filter((asset) => {
    const used = asset.roomStocks.reduce((sum, item) => sum + item.quantity, 0);
    if (asset.deletedAt || asset.stockQuantity <= used) return false;
    const text = `${asset.name} ${asset.assetCode}`.toLowerCase();
    return text.includes(query.trim().toLowerCase());
  });

  async function addSelected(close: () => void) {
    setSaving(true);
    setError("");
    let added = 0;
    try {
      for (const id of selected) {
        const asset = assets.find((item) => item.id === id);
        if (!asset) continue;
        const existing = asset.roomStocks.find((item) => item.locationId === room.id)?.quantity ?? 0;
        const result = await setAssetRoomStock(id, room.id, { quantity: existing + 1 });
        if (!result.ok) {
          setError(result.error ?? "Gagal memindahkan aset.");
          return;
        }
        added += 1;
      }
      if (added > 0) onAdded(added);
      setSelected([]);
      setQuery("");
      close();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) { setSelected([]); setQuery(""); setError(""); }
    }} size="lg">
      {({ close }) => <ModalDialog>
        <ModalHeader title="Tambah aset ke ruangan" />
        <ModalBody>
          <SearchField aria-label="Cari aset tersedia" placeholder="Cari nama atau kode aset" value={query} onChange={setQuery} />
          <div className="mt-3 flex flex-col gap-2">
            {available.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border-button-default p-5 text-center text-body-regular text-text-tertiary">
                {query ? "Aset tidak ditemukan." : "Tidak ada aset tersedia di inventaris."}
              </p>
            ) : available.map((asset) => (
              <Checkbox
                key={asset.id}
                isSelected={selected.includes(asset.id)}
                onChange={(checked) => setSelected((current) => checked ? [...current, asset.id] : current.filter((id) => id !== asset.id))}
                className="w-full rounded-xl border border-border-button-default p-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body-medium text-text-primary">{asset.name}</span>
                  <span className="block text-caption-1-regular text-text-tertiary">
                    {categoryName.get(asset.categoryId) ?? "Tanpa kategori"} · {Math.max(0, asset.stockQuantity - asset.roomStocks.reduce((sum, item) => sum + item.quantity, 0))} unit tersedia
                  </span>
                </span>
              </Checkbox>
            ))}
          </div>
          {error && <p className="mt-3 text-caption-1-regular text-text-error-primary">{error}</p>}
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={close}>Batal</Button>
          <Button disabled={selected.length === 0 || saving} onClick={() => void addSelected(close)}>
            {saving ? "Menyimpan…" : `Tambahkan${selected.length ? ` (${selected.length})` : ""}`}
          </Button>
        </ModalFooter>
      </ModalDialog>}
    </Modal>
  );
}

function AssetRoomCard({ asset, roomId, roomName, quantity, setAssetRoomStock }: { asset: Asset; roomId: string; roomName: string; quantity: number; setAssetRoomStock: (id: string, locationId: string, input: { quantity: number }) => Promise<{ ok: boolean; error?: string }> }) {
  const { showToast } = useApp();
  const [error, setError] = useState("");
  return (
    <div className="rounded-2xl border border-border-button-default p-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-body-medium text-text-primary">{asset.name}</div>
            <div className="truncate text-caption-1-regular text-text-tertiary">{asset.assetCode}</div>
          </div>
          <AssetPhotoControl asset={asset} ownerId={assetRoomPhotoOwnerId(asset.id, roomId)} roomName={roomName} />
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-xl border border-border-button-default p-1">
          <Button size="small" variant="secondary" iconOnly leadingIcon={RiSubtractLine} aria-label={`Kurangi jumlah ${asset.name} di ruangan`} onClick={async () => {
            const result = await setAssetRoomStock(asset.id, roomId, { quantity: quantity - 1 });
            setError(result.ok ? "" : result.error ?? "Gagal memperbarui jumlah.");
            if (result.ok) showToast("Jumlah ruangan diperbarui", asset.name);
          }} />
          <div className="min-w-11 px-1 text-center">
            <div className="text-body-medium text-text-primary">{quantity}</div>
            <div className="text-caption-1-regular text-text-tertiary">dipakai</div>
          </div>
        </div>
      </div>
      {error && <p className="mt-2 text-caption-1-regular text-text-error-primary">{error}</p>}
    </div>
  );
}

function AttachmentGallery({ ownerType, ownerId }: { ownerType: AttachmentOwner; ownerId: string }) {
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const previewUrls = useRef<string[]>([]);

  const refresh = useCallback(async () => setAttachments(await listAttachments(ownerType, ownerId)), [ownerType, ownerId]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { window.addEventListener("online", refresh); return () => window.removeEventListener("online", refresh); }, [refresh]);
  useEffect(() => {
    let cancelled = false;
    void Promise.all(attachments.map(async (item) => [item.id, await attachmentUrl(item.id)] as const)).then((rows) => {
      const available = rows.filter((row): row is readonly [string, string] => Boolean(row[1]));
      if (cancelled) {
        available.forEach(([, url]) => { if (url.startsWith("blob:")) URL.revokeObjectURL(url); });
        return;
      }
      previewUrls.current.forEach((url) => { if (url.startsWith("blob:")) URL.revokeObjectURL(url); });
      previewUrls.current = available.map(([, url]) => url).filter((url) => url.startsWith("blob:"));
      setPreviews(Object.fromEntries(available));
    });
    return () => {
      cancelled = true;
    };
  }, [attachments]);
  useEffect(() => () => previewUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  async function upload(file: File) {
    try {
      const saved = await saveAttachment(ownerType, ownerId, file);
      setError(saved.localOnly ? "Gambar tersimpan di perangkat ini dan menunggu koneksi untuk diunggah." : "");
      await refresh();
    } catch {
      setError("Gambar gagal disimpan di perangkat ini.");
    }
  }

  async function remove(item: LocalAttachment) {
    await deleteAttachment(item.id, item.objectKey);
    await refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <FileUpload allowedExtensions={["jpg", "jpeg", "png", "webp"]} maxBytes={20 * 1024 * 1024} onUploadComplete={(file) => void upload(file)} />
      {error && <p className="text-caption-1-regular text-text-error-primary">{error}</p>}
      {attachments.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {attachments.map((item) => (
            <div key={item.id} className="overflow-hidden rounded-xl border border-border-button-default">
              {previews[item.id] ? <img src={previews[item.id]} alt={item.fileName} className="aspect-square w-full object-cover" /> : <div className="aspect-square bg-background-tertiary-default" />}
              <div className="flex items-center gap-2 p-2">
                <span className="min-w-0 flex-1 truncate text-caption-1-regular text-text-secondary">{item.fileName}</span>
                <Button size="small" variant="ghost" leadingIcon={RiDeleteBinLine} aria-label={`Hapus ${item.fileName}`} onClick={() => void remove(item)} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
