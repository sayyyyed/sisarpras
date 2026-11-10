import { useMemo } from "react";
import { RiArrowLeftLine, RiEditLine } from "@remixicon/react";
import { useNavigate, useParams } from "react-router-dom";
import { Chip, type ChipColor } from "@/components/base/badges/chip";
import { Button } from "@/components/base/buttons/button";
import { AssetPhotoControl, assetRoomPhotoOwnerId } from "@/features/assets/asset-photo-control";
import { PageHeading, Panel, SectionHeading } from "@/components/ui/primitives";
import { formatNumber } from "@/lib/format";
import { useApp } from "@/lib/store";

export default function AssetDetailPage() {
  const { assetId } = useParams();
  const navigate = useNavigate();
  const { assets, categories, locations, loading } = useApp();
  const asset = assets.find((item) => item.id === assetId);
  const category = categories.find((item) => item.id === asset?.categoryId);
  const roomById = useMemo(() => new Map(locations.map((item) => [item.id, item])), [locations]);

  if (!asset && !loading) {
    return <Panel padded><p className="text-body-regular text-text-secondary">Barang tidak ditemukan.</p><Button className="mt-4" variant="secondary" onClick={() => navigate("/assets")}>Kembali ke Aset</Button></Panel>;
  }
  if (!asset) return <Panel padded><p className="text-body-regular text-text-secondary">Memuat barang…</p></Panel>;

  const used = asset.roomStocks.reduce((sum, item) => sum + item.quantity, 0);
  const remaining = Math.max(0, asset.stockQuantity - used);
  const stockColor: ChipColor = asset.stockQuantity === 0 || remaining === 0 ? "rose" : remaining / asset.stockQuantity <= 0.2 ? "yellow" : "lime";

  return (
    <>
      <PageHeading
        title={asset.name}
        subtitle={`${formatNumber(used)} dipakai / ${formatNumber(asset.stockQuantity)} stok`}
        actions={<><Button variant="secondary" leadingIcon={RiEditLine} onClick={() => navigate(`/assets/${asset.id}/edit`)}>Edit</Button><Button variant="ghost" leadingIcon={RiArrowLeftLine} onClick={() => navigate("/assets")}>Kembali ke Aset</Button></>}
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Panel padded>
          <SectionHeading title="Jumlah per Ruangan" />
          {asset.roomStocks.length === 0 ? (
            <p className="mt-4 text-body-regular text-text-tertiary">Belum ditempatkan di ruangan.</p>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              {asset.roomStocks.map((allocation) => {
                const room = roomById.get(allocation.locationId);
                return <div key={allocation.locationId} className="flex items-center gap-3 rounded-xl border border-border-button-default p-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-body-medium text-text-primary">{room?.name ?? "Ruangan tidak diketahui"}</div>
                    <div className="text-caption-1-regular text-text-tertiary">{[room?.building, room?.floor].filter(Boolean).join(" · ")}</div>
                  </div>
                  <AssetPhotoControl asset={asset} ownerId={assetRoomPhotoOwnerId(asset.id, allocation.locationId)} roomName={room?.name ?? "Ruangan"} />
                  <Chip variant="caption" color="neutral">{formatNumber(allocation.quantity)} unit</Chip>
                </div>;
              })}
            </div>
          )}
        </Panel>
        <Panel padded>
          <SectionHeading title="Informasi Barang" />
          <dl className="mt-4 flex flex-col gap-3">
            <InfoRow label="Kategori">{category?.name ?? "—"}</InfoRow>
            <InfoRow label="Stok"><Chip variant="bold" color={stockColor}>{formatNumber(used)} dipakai / {formatNumber(asset.stockQuantity)} stok</Chip></InfoRow>
            <InfoRow label="Tersedia">{formatNumber(remaining)} unit</InfoRow>
            {asset.description && <InfoRow label="Catatan">{asset.description}</InfoRow>}
          </dl>
        </Panel>
      </div>
    </>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex items-start justify-between gap-4 border-b border-separator-border pb-3 last:border-0 last:pb-0"><dt className="text-caption-1-regular text-text-tertiary">{label}</dt><dd className="text-end text-body-medium text-text-primary">{children}</dd></div>;
}
