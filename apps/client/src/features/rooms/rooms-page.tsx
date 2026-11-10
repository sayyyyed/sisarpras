import { useMemo, useState } from "react";
import { RiAddLine, RiArrowRightSLine, RiBuilding2Line, RiEditLine, RiStackLine } from "@remixicon/react";
import { useNavigate } from "react-router-dom";
import { ROOM_HEALTH_LABEL, type Location } from "@sisarpras/domain";
import { Avatar } from "@/components/base/avatar/avatar";
import { Chip, type ChipColor } from "@/components/base/badges/chip";
import { Button } from "@/components/base/buttons/button";
import { Divider } from "@/components/base/divider/divider";
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
import { PageHeading, Panel, SectionHeading } from "@/components/ui/primitives";
import { formatNumber } from "@/lib/format";
import { percent, summarizeRooms } from "@/lib/inventory";
import { useApp } from "@/lib/store";

const HEALTH_CHIP: Record<string, ChipColor> = { good: "lime", attention: "yellow", critical: "rose", storage: "cyan" };
const HEALTH_TONE: Record<string, MeterTone> = { good: "success", attention: "warning", critical: "error", storage: "accent" };

export default function RoomsPage() {
  const { assets, locations, stockItems } = useApp();
  const buildings = useMemo(() => locations.filter((item) => item.kind === "building"), [locations]);
  const floors = useMemo(() => locations.filter((item) => item.kind === "floor"), [locations]);
  const rooms = useMemo(() => locations.filter((item) => item.kind === "room" || item.kind === "storage"), [locations]);
  const summaries = useMemo(() => summarizeRooms(locations, assets), [locations, assets]);
  const navigate = useNavigate();


  // The empty state is the entry point: no building means no rooms yet.
  if (buildings.length === 0) {
    return (
      <>
        <PageHeading
          title="Ruangan"
          subtitle="Mulai dengan menambahkan gedung. Ruangan hanya bisa dibuat setelah gedung ada."
        />
        <Panel padded className="mx-auto max-w-[560px]">
          <SectionHeading title="Tambah Gedung Pertama" subtitle="Nama gedung dan jumlah lantainya." />
          <div className="mt-5">
            <BuildingForm />
          </div>
        </Panel>
      </>
    );
  }

  return (
    <>
      <PageHeading
        title="Ruangan"
        subtitle={`${buildings.length} gedung · ${rooms.length} ruangan · ${flatsLabel(floors.length)}`}
        actions={
          <ModalTrigger>
            <Button variant="secondary" leadingIcon={RiBuilding2Line}>
              Tambah Gedung
            </Button>
            <Modal size="md" aria-label="Tambah gedung">
              <ModalDialog aria-label="Tambah gedung">
                <ModalHeader title="Tambah Gedung" description="Lantai dibuat otomatis sesuai jumlah yang diisi." />
                <BuildingForm />
              </ModalDialog>
            </Modal>
          </ModalTrigger>
        }
      />

      <div className="flex flex-col gap-6">
        {buildings.map((building) => {
          const buildingFloors = floors.filter((floor) => floor.parentId === building.id);
          const buildingRooms = rooms.filter((room) => room.parentId === building.id || room.building === building.name);
          const buildingSummary = summaries.filter((summary) => buildingRooms.some((room) => room.id === summary.location.id));
          const totalAssets = buildingSummary.reduce((sum, item) => sum + item.totalAssets, 0);

          return (
            <Panel key={building.id} padded>
              <div className="flex flex-wrap items-center gap-3">
                <Avatar size="md" color="blue" initials={building.name.slice(0, 2).toUpperCase()} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-title-3-semibold text-text-primary">{building.name}</div>
                  <div className="text-caption-1-regular text-text-tertiary">
                    {buildingFloors.length} lantai · {buildingRooms.length} ruangan ·{" "}
                    {formatNumber(totalAssets)} aset
                  </div>
                </div>
                <ModalTrigger>
                  <Button size="small" variant="secondary" leadingIcon={RiEditLine}>
                    Edit Gedung
                  </Button>
                  <Modal size="md" aria-label="Edit gedung">
                    <ModalDialog aria-label="Edit gedung">
                      <ModalHeader title="Edit Gedung" description="Nama gedung akan diperbarui pada lantai dan ruangan terkait." />
                      <EditBuildingForm building={building} floors={buildingFloors} />
                    </ModalDialog>
                  </Modal>
                </ModalTrigger>
                <ModalTrigger>
                  <Button size="small" leadingIcon={RiAddLine}>
                    Tambah Ruangan
                  </Button>
                  <Modal size="md" aria-label="Tambah ruangan">
                    <ModalDialog aria-label="Tambah ruangan">
                      <ModalHeader title={`Tambah Ruangan — ${building.name}`} description="Pilih lantai dari gedung ini." />
                      <RoomForm building={building} floors={buildingFloors} />
                    </ModalDialog>
                  </Modal>
                </ModalTrigger>
              </div>

              <Divider className="my-4" />

              {buildingRooms.length === 0 ? (
                <div className="py-8 text-center text-body-regular text-text-tertiary">
                  Belum ada ruangan di gedung ini.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {buildingRooms.map((room) => {
                    const summary = summaries.find((item) => item.location.id === room.id);
                    const total = summary?.totalAssets ?? 0;
                    const isStorage = room.kind === "storage";
                    return (
                      <button
                        key={room.id}
                        type="button"
                        onClick={() => navigate(`/rooms/${room.id}`)}
                        className={`flex flex-col gap-3 rounded-2xl border border-border-button-default bg-background-primary-default p-4 text-left transition-colors hover:bg-background-secondary-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 ${room.active === false ? "opacity-55" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-title-3-semibold text-text-primary">{room.name}</div>
                            <div className="text-caption-1-regular text-text-tertiary">
                              {room.floor ?? "Lantai belum diset"}
                              {room.capacity ? ` · Kapasitas ${room.capacity}` : ""}
                            </div>
                          </div>
                          <Chip variant="bold" color={HEALTH_CHIP[summary?.health ?? "good"]}>
                            {ROOM_HEALTH_LABEL[summary?.health ?? "good"]}
                          </Chip>
                        </div>

                        <Meter
                          aria-label={`Kondisi aset ${room.name}`}
                          value={isStorage ? 100 : percent(summary?.byCondition.good ?? 0, total || 1)}
                          tone={HEALTH_TONE[summary?.health ?? "good"]}
                          size="sm"
                        />

                        <div className="flex items-center justify-between gap-2">
                          <span className="text-caption-1-regular text-text-tertiary">
                            {isStorage ? "Gudang penyimpanan" : `${total} aset`}
                          </span>
                          <span className="flex items-center gap-1 text-caption-1-semibold text-accent-600">
                            {room.active === false ? "Nonaktif · Detail" : "Detail"} <RiArrowRightSLine className="size-3.5" />
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </Panel>
          );
        })}
      </div>

      <Panel padded>
        <div className="flex items-center gap-2 text-body-medium text-text-secondary">
          <RiStackLine className="size-4" />
          {formatNumber(stockItems.length)} jenis stok habis pakai dikelola di halaman Stok, terpisah dari ruangan.
        </div>
      </Panel>
    </>
  );
}

function EditBuildingForm({ building, floors }: { building: Location; floors: Location[] }) {
  const close = useModalClose();
  const { updateBuilding, showToast } = useApp();
  const [name, setName] = useState(building.name);
  const [floorCount, setFloorCount] = useState<number | undefined>(floors.length);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return setError("Nama gedung wajib diisi.");
    if (!floorCount || floorCount < 1) return setError("Jumlah lantai minimal 1.");
    setSaving(true);
    try {
      const result = await updateBuilding(building.id, { name: trimmed, floorCount });
      if (!result.ok) return setError(result.error === "floor_has_rooms"
        ? "Lantai yang dikurangi masih memiliki ruangan. Pindahkan ruangan terlebih dahulu."
        : result.error ?? "Gagal memperbarui gedung.");
      showToast("Gedung diperbarui", `${trimmed} · ${floorCount} lantai`);
      close();
    } finally {
      setSaving(false);
    }
  }

  return <>
    <ModalBody>
      <div className="flex flex-col gap-3">
        <Input label="Nama gedung *" value={name} onChange={setName} />
        <NumberField
          label="Jumlah lantai *"
          minValue={1}
          maxValue={50}
          value={floorCount}
          onChange={(value) => setFloorCount(Number.isNaN(value) ? undefined : value)}
          hint="Lantai paling atas dihapus jika jumlah dikurangi."
        />
        {error && <p className="text-caption-1-regular text-text-error-primary">{error}</p>}
      </div>
    </ModalBody>
    <ModalFooter>
      <Button variant="secondary" onClick={close} disabled={saving}>Batal</Button>
      <Button onClick={save} disabled={saving}>{saving ? "Menyimpan…" : "Simpan"}</Button>
    </ModalFooter>
  </>;
}

function flatsLabel(count: number): string {
  return `${count} lantai`;
}

function BuildingForm() {
  const close = useModalClose();
  const { createBuilding, showToast } = useApp();
  const [name, setName] = useState("");
  const [floorCount, setFloorCount] = useState<number | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const trimmed = name.trim();
    const total = floorCount ?? 0;
    if (!trimmed) return setError("Nama gedung wajib diisi");
    if (total < 1) return setError("Jumlah lantai minimal 1");

    setSaving(true);
    try {
      const outcome = await createBuilding({ name: trimmed, floorCount: total });
      if (!outcome.ok) return setError(outcome.error ?? "Gagal menyimpan gedung");

      showToast("Gedung ditambahkan", `${trimmed} · ${total} lantai`);
      close();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <ModalBody>
        <div className="flex flex-col gap-5">
          <Input label="Nama gedung *" placeholder="cth. Gedung A" value={name} onChange={setName} />
          <NumberField
            label="Jumlah lantai *"
            minValue={1}
            maxValue={50}
            value={floorCount}
            onChange={(value) => setFloorCount(Number.isNaN(value) ? undefined : value)}
            hint="Lantai (Lantai 1, Lantai 2, …) dibuat otomatis."
          />
          {error && <p className="text-caption-1-regular text-text-error-primary">{error}</p>}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={close} disabled={saving}>
          Batal
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? "Menyimpan..." : "Simpan Gedung"}
        </Button>
      </ModalFooter>
    </>
  );
}

function RoomForm({ building, floors }: { building: Location; floors: Location[] }) {
  const close = useModalClose();
  const { createLocation, showToast } = useApp();
  const [name, setName] = useState("");
  const [floorId, setFloorId] = useState<string | null>(null);
  const [capacity, setCapacity] = useState<number | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const floor = floors.find((item) => item.id === floorId) ?? null;

  async function save() {
    if (!name.trim()) return setError("Nama ruangan wajib diisi");
    if (!floor) return setError("Pilih lantai dulu");

    setSaving(true);
    try {
      const outcome = await createLocation({
        name: name.trim(),
        kind: "room",
        parentId: floor.id,
        building: building.name,
        floor: floor.name,
        capacity: capacity ?? null,
      });
      if (!outcome.ok) return setError(outcome.error ?? "Gagal menyimpan ruangan");
      showToast("Ruangan ditambahkan", `${name.trim()} · ${building.name} ${floor.name}`);
      close();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <ModalBody>
        <div className="flex flex-col gap-5">
          <Input label="Nama ruangan *" placeholder="cth. Ruang 201 - Rapat" value={name} onChange={setName} />

          {floors.length === 0 ? (
            <p className="rounded-xl bg-background-tertiary-default p-3 text-caption-1-regular text-text-tertiary">
              Gedung ini belum punya data lantai. Buat ulang gedung lewat "Tambah Gedung" dengan jumlah lantai, agar
              lantainya tersimpan.
            </p>
          ) : (
            <Select
              label="Lantai *"
              placeholder="Pilih lantai..."
              selectedKey={floorId}
              onSelectionChange={(key) => setFloorId(key === null ? null : String(key))}
            >
              {floors.map((item) => (
                <SelectItem key={item.id} id={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </Select>
          )}

          <NumberField
            label="Kapasitas"
            minValue={0}
            value={capacity}
            onChange={(value) => setCapacity(Number.isNaN(value) ? undefined : value)}
          />

          {error && <p className="text-caption-1-regular text-text-error-primary">{error}</p>}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={close} disabled={saving}>
          Batal
        </Button>
        <Button onClick={save} disabled={saving || floors.length === 0}>
          {saving ? "Menyimpan..." : "Simpan Ruangan"}
        </Button>
      </ModalFooter>
    </>
  );
}
