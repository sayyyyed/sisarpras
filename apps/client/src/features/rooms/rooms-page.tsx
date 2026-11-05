import { useState } from "react";
import { RiAddLine, RiStackLine } from "@remixicon/react";
import { LOCATION_KIND_LABEL, ROOM_HEALTH_LABEL, LocationDraftSchema, type LocationKind } from "@sisarpras/domain";
import { Avatar } from "@/components/base/avatar/avatar";
import { Chip, type ChipColor } from "@/components/base/badges/chip";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Meter, type MeterTone } from "@/components/base/meter/meter";
import {
  Modal,
  ModalBody,
  ModalDialog,
  ModalFooter,
  ModalHeader,
  ModalTrigger,
  useModalClose,
} from "@/components/base/modal/modal";
import { NumberField } from "@/components/base/number-field/number-field";
import { Select, SelectItem } from "@/components/base/select/select";
import { PageHeading, Panel } from "@/components/ui/primitives";
import { stockItems } from "@/data/mock";
import { percent, summarizeRooms } from "@/lib/inventory";
import { useApp } from "@/lib/store";
import type { LocationDraft } from "@sisarpras/domain";

const HEALTH_CHIP: Record<string, ChipColor> = {
  good: "lime",
  attention: "yellow",
  critical: "rose",
  storage: "cyan",
};

const HEALTH_TONE: Record<string, MeterTone> = {
  good: "success",
  attention: "warning",
  critical: "error",
  storage: "accent",
};

export default function RoomsPage() {
  const { assets, locations } = useApp();
  const rooms = summarizeRooms(locations, assets);
  const totalStock = stockItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <>
      <PageHeading
        title="Ruangan"
        subtitle="Klasifikasi status tiap ruangan dihitung dari kondisi aset di dalamnya"
        actions={
          <ModalTrigger>
            <Button leadingIcon={RiAddLine}>Tambah Ruangan</Button>
            <Modal size="md" aria-label="Tambah ruangan">
              <ModalDialog aria-label="Tambah ruangan">
                <ModalHeader
                  title="Tambah Ruangan"
                  description="Gedung, lantai, ruangan, atau gudang. Tersimpan ke PostgreSQL."
                />
                <NewRoomForm />
              </ModalDialog>
            </Modal>
          </ModalTrigger>
        }
      />

      <Panel padded>
        <div className="flex flex-wrap items-end gap-3">
          <Select aria-label="Filter gedung" className="w-[200px]" defaultSelectedKey="all">
            <SelectItem id="all">Semua gedung</SelectItem>
            <SelectItem id="a">Gedung A</SelectItem>
            <SelectItem id="b">Gedung B</SelectItem>
          </Select>
          <Select aria-label="Filter lantai" className="w-[180px]" defaultSelectedKey="all">
            <SelectItem id="all">Semua lantai</SelectItem>
            <SelectItem id="1">Lantai 1</SelectItem>
            <SelectItem id="2">Lantai 2</SelectItem>
            <SelectItem id="3">Lantai 3</SelectItem>
          </Select>
        </div>
      </Panel>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {rooms.map((room) => {
          const isStorage = room.health === "storage";
          const healthy = isStorage
            ? percent(
                stockItems.filter((item) => item.quantity >= item.reorderLevel).length,
                stockItems.length,
              )
            : percent(room.byCondition.good, room.totalAssets);

          return (
            <Panel key={room.location.id} padded className="flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <Avatar
                  size="md"
                  color={isStorage ? "blue" : "neutral"}
                  initials={room.location.name.slice(0, 2).toUpperCase()}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-title-3-semibold text-text-primary">{room.location.name}</div>
                  <div className="text-caption-1-regular text-text-tertiary">
                    {room.location.building} · {room.location.floor}
                    {room.location.capacity ? ` · Kapasitas ${room.location.capacity}` : ""}
                  </div>
                </div>
                <Chip variant="bold" color={HEALTH_CHIP[room.health] ?? "neutral"}>
                  {ROOM_HEALTH_LABEL[room.health]}
                </Chip>
              </div>

              <Meter
                label={
                  isStorage
                    ? `${stockItems.length} jenis stok · ${totalStock} unit tersedia`
                    : `${room.totalAssets} aset di ruangan ini`
                }
                showValueLabel
                tone={HEALTH_TONE[room.health] ?? "accent"}
                value={healthy}
              />

              {isStorage ? (
                <div className="flex flex-wrap gap-2">
                  {stockItems.map((item) => (
                    <Chip
                      key={item.id}
                      variant="caption"
                      color={item.quantity < item.reorderLevel ? "yellow" : "lime"}
                    >
                      {item.name} · {item.quantity} {item.unit}
                    </Chip>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Chip variant="bold" color="lime">
                    Baik {room.byCondition.good}
                  </Chip>
                  <Chip variant="bold" color="yellow">
                    Cukup {room.byCondition.fair}
                  </Chip>
                  <Chip variant="bold" color="rose">
                    Rusak {room.byCondition.damaged}
                  </Chip>
                </div>
              )}
            </Panel>
          );
        })}
      </div>

      <Panel padded>
        <div className="flex items-center gap-2 text-body-medium text-text-secondary">
          <RiStackLine className="size-4" />
          Ruangan ber-kondisi kritis (kerusakan ≥ 15%) perlu ditinjau lebih dulu sebelum pengadaan baru.
        </div>
      </Panel>
    </>
  );
}

function NewRoomForm() {
  const close = useModalClose();
  const { createLocation, locations, showToast } = useApp();

  const [name, setName] = useState("");
  const [kind, setKind] = useState<LocationKind>("room");
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const [floor, setFloor] = useState("");
  const [capacity, setCapacity] = useState<number | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildings = locations.filter((item) => item.kind === "building");

  async function save() {
    const parent = buildings.find((item) => item.id === buildingId) ?? null;

    const parsed = LocationDraftSchema.safeParse({
      name: name.trim(),
      kind,
      // A building is its own root; children point at the selected building.
      parentId: kind === "building" ? null : (parent?.id ?? null),
      building: kind === "building" ? name.trim() || null : (parent?.name ?? null),
      floor: floor.trim() || null,
      capacity: capacity ?? null,
    } satisfies LocationDraft);

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Data belum lengkap");
      return;
    }

    setSaving(true);
    try {
      const outcome = await createLocation(parsed.data);
      if (!outcome.ok) {
        setError(outcome.error ?? "Gagal menyimpan ruangan");
        return;
      }
      showToast(
        outcome.queued ? "Tersimpan di perangkat" : "Ruangan ditambahkan",
        outcome.queued ? "Server belum terjangkau — akan disinkronkan nanti" : parsed.data.name,
      );
      close();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <ModalBody>
        <div className="flex flex-col gap-5">
          <Input
            label="Nama *"
            placeholder="cth. Ruang 401 - Rapat"
            value={name}
            onChange={setName}
            isInvalid={Boolean(error)}
          />

          <Select
            label="Jenis"
            selectedKey={kind}
            onSelectionChange={(key) => setKind(String(key) as LocationKind)}
          >
            {(Object.keys(LOCATION_KIND_LABEL) as LocationKind[]).map((value) => (
              <SelectItem key={value} id={value}>
                {LOCATION_KIND_LABEL[value]}
              </SelectItem>
            ))}
          </Select>

          {kind !== "building" && (
            <Select
              label="Gedung induk"
              placeholder="Pilih gedung..."
              selectedKey={buildingId}
              onSelectionChange={(key) => setBuildingId(key === null ? null : String(key))}
            >
              {buildings.map((item) => (
                <SelectItem key={item.id} id={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </Select>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <Input label="Lantai" placeholder="cth. Lantai 4" value={floor} onChange={setFloor} />
            <NumberField
              label="Kapasitas"
              minValue={0}
              value={capacity}
              onChange={(value) => setCapacity(Number.isNaN(value) ? undefined : value)}
            />
          </div>

          {error && <p className="text-caption-1-regular text-text-error-primary">{error}</p>}
        </div>
      </ModalBody>

      <ModalFooter>
        <Button variant="secondary" onClick={close} disabled={saving}>
          Batal
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? "Menyimpan..." : "Simpan Ruangan"}
        </Button>
      </ModalFooter>
    </>
  );
}
