import { useEffect, useState } from "react";
import { Panel, SectionHeading } from "@/components/ui/primitives";
import { formatNumber } from "@/lib/format";
import { listAllAttachments, type LocalAttachment } from "@/lib/local-attachments";

export function SettingsStorage() {
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);

  useEffect(() => {
    void listAllAttachments().then(setAttachments).catch(() => setAttachments([]));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <Panel padded>
        <SectionHeading title="Penyimpanan berkas" subtitle="Berkas tersimpan di perangkat dari halaman aset dan ruang." />
        <p className="mt-3 text-body-regular text-text-secondary">
          {formatNumber(attachments.length)} berkas tersimpan lokal di perangkat ini. Unggah foto dari ruang atau aset agar gambar terhubung dengan datanya.
        </p>
      </Panel>
      {attachments.length > 0 && (
        <Panel padded>
          <SectionHeading title="Berkas tersimpan" />
          <ul className="mt-3 flex flex-col divide-y divide-separator-border">
            {attachments.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate text-body-medium text-text-primary">{item.fileName}</span>
                <span className="shrink-0 text-caption-1-regular text-text-tertiary">
                  {item.ownerType === "location" ? "Ruang" : item.ownerType === "asset" ? "Aset" : "Pengadaan"} · {new Date(item.createdAt).toLocaleDateString("id-ID")}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
