import { useCallback, useEffect, useRef, useState } from "react";
import { RiDeleteBinLine, RiImageAddLine, RiImageLine } from "@remixicon/react";
import type { Asset } from "@sisarpras/domain";
import { Button } from "@/components/base/buttons/button";
import { FileUpload } from "@/components/base/file-upload/file-upload";
import { Modal, ModalBody, ModalDialog, ModalFooter, ModalHeader } from "@/components/base/modal/modal";
import { attachmentUrl, deleteAttachment, listAttachments, saveAttachment, type LocalAttachment } from "@/lib/local-attachments";

export function assetRoomPhotoOwnerId(assetId: string, roomId: string): string {
  return `${assetId}::room::${roomId}`;
}

export function AssetPhotoControl({ asset, ownerId, roomName }: { asset: Asset; ownerId: string; roomName: string }) {
  const [open, setOpen] = useState(false);
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const previewUrls = useRef<string[]>([]);

  const refresh = useCallback(async () => setAttachments(await listAttachments("asset", ownerId)), [ownerId]);
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
    return () => { cancelled = true; };
  }, [attachments]);
  useEffect(() => () => previewUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  async function upload(file: File) {
    try {
      const saved = await saveAttachment("asset", ownerId, file);
      setError(saved.localOnly ? "Foto tersimpan di perangkat ini dan menunggu koneksi untuk diunggah." : "");
      await refresh();
    } catch {
      setError("Foto gagal disimpan.");
    }
  }

  async function remove(item: LocalAttachment) {
    await deleteAttachment(item.id, item.objectKey);
    await refresh();
  }

  const thumbnail = attachments.find((item) => previews[item.id]);

  return (
    <>
      <div className="relative size-14 shrink-0">
        <div className="size-full overflow-hidden rounded-xl border border-border-button-default bg-background-tertiary-default">
          {thumbnail ? (
            <img src={previews[thumbnail.id]} alt={`Foto ${asset.name}`} className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-foreground-icon-quaternary">
              <RiImageLine className="size-5" aria-hidden />
            </div>
          )}
        </div>
        <Button
          size="xs"
          variant="secondary"
          iconOnly
          leadingIcon={RiImageAddLine}
          className="absolute -bottom-1.5 -right-1.5 z-10 rounded-full shadow-xs"
          aria-label={`Tambah foto ${asset.name} di ${roomName}`}
          onClick={() => setOpen(true)}
        />
      </div>

      <Modal isOpen={open} onOpenChange={setOpen} size="md">
        <ModalDialog aria-label={`Foto ${asset.name}`}>
          <ModalHeader title={`Foto barang · ${roomName}`} />
          <ModalBody>
            <FileUpload allowedExtensions={["jpg", "jpeg", "png", "webp"]} maxBytes={20 * 1024 * 1024} onUploadComplete={(file) => void upload(file)} />
            {error && <p className="mt-3 text-caption-1-regular text-text-error-primary">{error}</p>}
            {attachments.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
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
          </ModalBody>
          <ModalFooter><Button variant="secondary" onClick={() => setOpen(false)}>Tutup</Button></ModalFooter>
        </ModalDialog>
      </Modal>
    </>
  );
}
