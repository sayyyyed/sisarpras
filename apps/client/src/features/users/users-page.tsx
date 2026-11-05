import { useState, type FormEvent } from "react";
import { RiAddLine, RiDeleteBinLine, RiKey2Line } from "@remixicon/react";
import { Avatar } from "@/components/base/avatar/avatar";
import { Badge } from "@/components/base/badges/badge";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select, SelectItem } from "@/components/base/select/select";
import { AlertDialog, ModalTrigger } from "@/components/base/modal/modal";
import { InputOtp } from "@/components/base/input-otp/input-otp";
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@/components/base/table/table";
import { PageHeading, Panel } from "@/components/ui/primitives";
import { useAuth, type UserRole } from "@/lib/auth";

const ROLE_LABEL: Record<UserRole, string> = { admin: "Admin", operator: "Operator", viewer: "Viewer" };

export default function UsersPage() {
  const { users, user, addUser, updateUser, removeUser } = useAuth();
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [role, setRole] = useState<UserRole>("operator");
  const [editingPinId, setEditingPinId] = useState<string | null>(null);
  const [editingPin, setEditingPin] = useState("");
  const [message, setMessage] = useState("");
  const adminCount = users.filter((entry) => entry.role === "admin").length;

  async function create(event: FormEvent) {
    event.preventDefault();
    if (pin.length !== 6) { setMessage("PIN harus 6 digit."); return; }
    await addUser(name, role, pin);
    setName(""); setPin(""); setRole("operator"); setMessage("User berhasil ditambahkan.");
  }

  async function savePin(id: string) {
    if (editingPin.length !== 6) return;
    await updateUser(id, { pin: editingPin });
    setEditingPinId(null); setEditingPin(""); setMessage("PIN berhasil diperbarui.");
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeading title="Manajemen User" subtitle="Kelola akun, PIN, dan hak akses pengguna aplikasi." />

      <Panel className="p-5 sm:p-6">
        <div className="mb-5">
          <h2 className="text-title-2-medium text-text-primary">Tambah user</h2>
          <p className="mt-1 text-body-regular text-text-secondary">Buat akun baru dengan PIN enam digit dan peran akses.</p>
        </div>
        <form onSubmit={create} className="grid gap-4 lg:grid-cols-[minmax(180px,1fr)_auto_minmax(160px,0.8fr)_auto] lg:items-end">
          <Input label="Nama user" value={name} onChange={setName} placeholder="Nama lengkap" isRequired />
          <div className="flex flex-col gap-1.5">
            <span className="text-body-medium text-text-primary">PIN</span>
            <InputOtp value={pin} onChange={setPin} length={6} aria-label="PIN user baru, enam digit" />
          </div>
          <Select label="Peran" selectedKey={role} onSelectionChange={(key) => setRole(String(key) as UserRole)}>
            <SelectItem id="admin">Admin</SelectItem>
            <SelectItem id="operator">Operator</SelectItem>
            <SelectItem id="viewer">Viewer</SelectItem>
          </Select>
          <Button type="submit" leadingIcon={RiAddLine} disabled={name.trim().length === 0 || pin.length !== 6}>Tambah user</Button>
        </form>
        {message && <p role="status" className="mt-4 text-body-2-regular text-text-secondary">{message}</p>}
      </Panel>

      <Panel className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-separator-border px-5 py-4">
          <div>
            <h2 className="text-title-2-medium text-text-primary">Akun terdaftar</h2>
            <p className="mt-1 text-body-regular text-text-secondary">{users.length} user memiliki akses ke aplikasi.</p>
          </div>
        </div>
        <Table aria-label="Daftar user" size="sm">
          <TableHeader>
            <TableColumn isRowHeader>Nama</TableColumn>
            <TableColumn>Peran</TableColumn>
            <TableColumn>Dibuat</TableColumn>
            <TableColumn>Aksi</TableColumn>
          </TableHeader>
          <TableBody>
            {users.map((item) => (
              <TableRow key={item.id} id={item.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar initials={item.name.slice(0, 2).toUpperCase()} color={item.role === "admin" ? "blue" : item.role === "operator" ? "lime" : "neutral"} />
                    <div>
                      <p className="text-body-medium text-text-primary">{item.name}{item.id === user?.id && <span className="ms-2 text-caption-1-regular text-text-tertiary">(Anda)</span>}</p>
                      {editingPinId === item.id && (
                        <div className="mt-3 flex flex-wrap items-end gap-2">
                          <div className="flex flex-col gap-1.5">
                            <span className="text-caption-1-semibold text-text-secondary">PIN baru</span>
                            <InputOtp value={editingPin} onChange={setEditingPin} length={6} aria-label={`PIN baru untuk ${item.name}`} />
                          </div>
                          <Button size="small" onClick={() => void savePin(item.id)} disabled={editingPin.length !== 6}>Simpan PIN</Button>
                          <Button size="small" variant="secondary" onClick={() => { setEditingPinId(null); setEditingPin(""); }}>Batal</Button>
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell><Badge>{ROLE_LABEL[item.role]}</Badge></TableCell>
                <TableCell>{new Date(item.createdAt).toLocaleDateString("id-ID")}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button size="small" variant="secondary" leadingIcon={RiKey2Line} onClick={() => { setEditingPinId(item.id); setEditingPin(""); setMessage(""); }}>Ubah PIN</Button>
                    <Select aria-label={`Ubah peran ${item.name}`} isDisabled={item.role === "admin" && adminCount < 2} selectedKey={item.role} onSelectionChange={(key) => void updateUser(item.id, { role: String(key) as UserRole })}>
                      <SelectItem id="admin">Admin</SelectItem><SelectItem id="operator">Operator</SelectItem><SelectItem id="viewer">Viewer</SelectItem>
                    </Select>
                    <ModalTrigger>
                      <Button size="small" variant="danger" leadingIcon={RiDeleteBinLine} aria-label={`Hapus ${item.name}`} disabled={item.id === user?.id || (item.role === "admin" && adminCount < 2)}>Hapus</Button>
                      <AlertDialog
                        title="Hapus user?"
                        description={`Akun ${item.name} akan kehilangan akses ke aplikasi.`}
                        confirmLabel="Hapus user"
                        cancelLabel="Batal"
                        onConfirm={() => removeUser(item.id)}
                      />
                    </ModalTrigger>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </div>
  );
}
