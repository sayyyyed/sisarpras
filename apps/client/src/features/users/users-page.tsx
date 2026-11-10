import { useEffect, useState, type FormEvent } from "react";
import { RiAddLine, RiDeleteBinLine, RiKey2Line, RiPencilLine } from "@remixicon/react";
import { Avatar } from "@/components/base/avatar/avatar";
import { Badge } from "@/components/base/badges/badge";
import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Input } from "@/components/base/input/input";
import { Select, SelectItem } from "@/components/base/select/select";
import { AlertDialog, ModalTrigger } from "@/components/base/modal/modal";
import { InputOtp } from "@/components/base/input-otp/input-otp";
import { Switch } from "@/components/base/switch/switch";
import { Tab, TabList, TabPanel, Tabs } from "@/components/base/tabs/tabs";
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@/components/base/table/table";
import { PageHeading, Panel } from "@/components/ui/primitives";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { APP_MENU_DEFINITIONS } from "@sisarpras/domain";

const ROLE_CACHE_KEY = "sisarpras.roles.v1";
const MENU_CACHE_KEY = "sisarpras.menu-state.v1";

interface RoleRecord {
  id: string;
  key: string;
  name: string;
  description: string | null;
  accessLevel: "operator" | "viewer" | "admin";
  menuKeys: string[];
  isSystem: boolean;
  userCount: number;
}

interface MenuRecord { key: string; label: string; enabled: boolean; required: boolean; }
interface AccessConfig { roles: RoleRecord[]; menus: MenuRecord[]; }

function readCachedArray<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) ?? "[]") as T[]; } catch { return []; }
}

export default function UsersPage() {
  const { users, user, addUser, updateUser, removeUser, refreshCurrentUser } = useAuth();
  const [config, setConfig] = useState<AccessConfig>({ roles: [], menus: [] });
  const [configLoaded, setConfigLoaded] = useState(false);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [roleId, setRoleId] = useState("");
  const [editingPinId, setEditingPinId] = useState<string | null>(null);
  const [editingPin, setEditingPin] = useState("");
  const [message, setMessage] = useState("");
  const adminCount = users.filter((entry) => entry.role === "admin").length;

  async function loadConfig() {
    try {
      const result = await apiRequest<{ data: AccessConfig }>("/v1/access/config");
      setConfig(result.data);
      localStorage.setItem(ROLE_CACHE_KEY, JSON.stringify(result.data.roles));
      localStorage.setItem(MENU_CACHE_KEY, JSON.stringify(result.data.menus));
    } catch {
      setConfig({ roles: readCachedArray<RoleRecord>(ROLE_CACHE_KEY), menus: readCachedArray<MenuRecord>(MENU_CACHE_KEY) });
    } finally { setConfigLoaded(true); }
  }
  useEffect(() => { void loadConfig(); }, []);
  useEffect(() => {
    if (!roleId && config.roles.length) setRoleId(config.roles.find((role) => role.accessLevel === "operator")?.id ?? config.roles[0].id);
  }, [config.roles, roleId]);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (pin.length !== 6) { setMessage("PIN harus 6 digit."); return; }
    try {
      await addUser(name, roleId, pin);
      setName(""); setPin(""); setMessage("User berhasil ditambahkan.");
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "User gagal ditambahkan."); }
  }

  async function savePin(id: string) {
    if (editingPin.length !== 6) return;
    try {
      await updateUser(id, { pin: editingPin });
      setEditingPinId(null); setEditingPin(""); setMessage("PIN berhasil diperbarui.");
    } catch { setMessage("PIN gagal diperbarui."); }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeading title="Manajemen User" subtitle="Kelola akun, peran, dan akses menu pengguna aplikasi." />
      <Tabs aria-label="Manajemen user dan peran" defaultSelectedKey="users">
        <TabList aria-label="Bagian manajemen">
          <Tab id="users">Pengguna</Tab>
          <Tab id="roles">Peran & Menu</Tab>
        </TabList>
        <TabPanel id="users" className="flex flex-col gap-6">
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
              <Select label="Peran" selectedKey={roleId || null} onSelectionChange={(key) => setRoleId(String(key))} isDisabled={!configLoaded || config.roles.filter((role) => role.accessLevel !== "admin").length === 0}>
                {config.roles.filter((role) => role.accessLevel !== "admin").map((role) => <SelectItem key={role.id} id={role.id}>{role.name}</SelectItem>)}
              </Select>
              <Button type="submit" leadingIcon={RiAddLine} disabled={name.trim().length === 0 || pin.length !== 6 || !roleId}>Tambah user</Button>
            </form>
            {message && <p role="status" className="mt-4 text-body-2-regular text-text-secondary">{message}</p>}
          </Panel>

          <Panel className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-separator-border px-5 py-4">
              <div><h2 className="text-title-2-medium text-text-primary">Akun terdaftar</h2><p className="mt-1 text-body-regular text-text-secondary">{users.length} user memiliki akses ke aplikasi.</p></div>
            </div>
            <Table aria-label="Daftar user" size="sm">
              <TableHeader><TableColumn isRowHeader>Nama</TableColumn><TableColumn>Peran</TableColumn><TableColumn>Dibuat</TableColumn><TableColumn>Aksi</TableColumn></TableHeader>
              <TableBody>
                {users.map((item) => (
                  <TableRow key={item.id} id={item.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar initials={item.name.slice(0, 2).toUpperCase()} color={item.role === "admin" ? "blue" : item.role === "operator" ? "lime" : "neutral"} />
                        <div><p className="text-body-medium text-text-primary">{item.name}{item.id === user?.id && <span className="ms-2 text-caption-1-regular text-text-tertiary">(Anda)</span>}</p>
                          {editingPinId === item.id && <div className="mt-3 flex flex-wrap items-end gap-2"><div className="flex flex-col gap-1.5"><span className="text-caption-1-semibold text-text-secondary">PIN baru</span><InputOtp value={editingPin} onChange={setEditingPin} length={6} aria-label={`PIN baru untuk ${item.name}`} /></div><Button size="small" onClick={() => void savePin(item.id)} disabled={editingPin.length !== 6}>Simpan PIN</Button><Button size="small" variant="secondary" onClick={() => { setEditingPinId(null); setEditingPin(""); }}>Batal</Button></div>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Badge>{item.roleName ?? item.role}</Badge></TableCell>
                    <TableCell>{new Date(item.createdAt).toLocaleDateString("id-ID")}</TableCell>
                    <TableCell><div className="flex items-center gap-2">
                      <Button size="small" variant="secondary" leadingIcon={RiKey2Line} onClick={() => { setEditingPinId(item.id); setEditingPin(""); setMessage(""); }}>Ubah PIN</Button>
                      <Select aria-label={`Ubah peran ${item.name}`} selectedKey={item.roleId ?? ""} isDisabled={item.role === "admin" && adminCount < 2} onSelectionChange={(key) => void updateUser(item.id, { roleId: String(key) })}>
                        {config.roles.filter((role) => item.role === "admin" || role.accessLevel !== "admin").map((role) => <SelectItem key={role.id} id={role.id}>{role.name}</SelectItem>)}
                      </Select>
                      <ModalTrigger><Button size="small" variant="danger" leadingIcon={RiDeleteBinLine} aria-label={`Hapus ${item.name}`} disabled={item.id === user?.id || (item.role === "admin" && adminCount < 2)}>Hapus</Button><AlertDialog title="Hapus user?" description={`Akun ${item.name} akan kehilangan akses ke aplikasi.`} confirmLabel="Hapus user" cancelLabel="Batal" onConfirm={() => removeUser(item.id)} /></ModalTrigger>
                    </div></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        </TabPanel>
        <TabPanel id="roles"><RoleManagement config={config} setConfig={setConfig} onRefresh={async () => { await loadConfig(); try { await refreshCurrentUser(); } catch { /* Keep the cached access until reconnect. */ } }} /></TabPanel>
      </Tabs>
    </div>
  );
}

function RoleManagement({ config, setConfig, onRefresh }: { config: AccessConfig; setConfig: (config: AccessConfig) => void; onRefresh: () => Promise<void> }) {
  const [selectedId, setSelectedId] = useState("");
  const [roleName, setRoleName] = useState("");
  const [description, setDescription] = useState("");
  const [accessLevel, setAccessLevel] = useState<"operator" | "viewer">("viewer");
  const [menuKeys, setMenuKeys] = useState<string[]>(["dashboard"]);
  const [notice, setNotice] = useState("");
  const selectedRole = config.roles.find((role) => role.id === selectedId);

  function startNew() { setSelectedId(""); setRoleName(""); setDescription(""); setAccessLevel("viewer"); setMenuKeys(["dashboard"]); }
  function editRole(role: RoleRecord) { setSelectedId(role.id); setRoleName(role.name); setDescription(role.description ?? ""); setAccessLevel(role.accessLevel === "operator" ? "operator" : "viewer"); setMenuKeys(role.menuKeys); }

  async function saveRole(event: FormEvent) {
    event.preventDefault();
    try {
      const body = { name: roleName, description: description || null, accessLevel, menuKeys };
      const result = await apiRequest<{ data: RoleRecord }>(selectedId ? `/v1/access/roles/${selectedId}` : "/v1/access/roles", { method: selectedId ? "PATCH" : "POST", body: JSON.stringify(body) });
      const next = selectedId ? config.roles.map((role) => role.id === selectedId ? result.data : role) : [...config.roles, result.data];
      setConfig({ ...config, roles: next });
      localStorage.setItem(ROLE_CACHE_KEY, JSON.stringify(next));
      setNotice("Peran berhasil disimpan.");
      if (!selectedId) editRole(result.data);
      await onRefresh();
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Peran gagal disimpan."); }
  }

  async function toggleMenu(menu: MenuRecord, enabled: boolean) {
    try {
      const result = await apiRequest<{ data: MenuRecord }>(`/v1/access/menus/${menu.key}`, { method: "PATCH", body: JSON.stringify({ enabled }) });
      const menus = config.menus.map((item) => item.key === menu.key ? result.data : item);
      setConfig({ ...config, menus });
      localStorage.setItem(MENU_CACHE_KEY, JSON.stringify(menus));
      setNotice(enabled ? `${menu.label} diaktifkan.` : `${menu.label} disembunyikan dari sidebar.`);
      await onRefresh();
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Status menu gagal diperbarui."); }
  }

  async function deleteRole(role: RoleRecord) {
    try {
      await apiRequest(`/v1/access/roles/${role.id}`, { method: "DELETE" });
      const roles = config.roles.filter((item) => item.id !== role.id);
      setConfig({ ...config, roles });
      localStorage.setItem(ROLE_CACHE_KEY, JSON.stringify(roles));
      startNew(); setNotice("Peran berhasil dihapus.");
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Peran gagal dihapus."); }
  }

  return (
    <div className="flex flex-col gap-6">
      <Panel className="overflow-hidden">
        <div className="border-b border-separator-border px-5 py-4"><h2 className="text-title-2-medium text-text-primary">Menu aplikasi</h2><p className="mt-1 text-body-regular text-text-secondary">Menu nonaktif disembunyikan dari sidebar dan akses API ditolak.</p></div>
        <div className="grid gap-1 p-4 sm:grid-cols-2">{config.menus.map((menu) => <div key={menu.key} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5"><div><p className="text-body-medium text-text-primary">{menu.label}</p>{menu.required && <p className="text-caption-1-regular text-text-tertiary">Menu inti, tidak dapat dinonaktifkan</p>}</div><Switch aria-label={`Aktifkan menu ${menu.label}`} isSelected={menu.enabled} isDisabled={menu.required} onChange={(selected) => void toggleMenu(menu, selected)} /></div>)}</div>
      </Panel>

      <Panel className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-separator-border px-5 py-4"><div><h2 className="text-title-2-medium text-text-primary">Peran</h2><p className="mt-1 text-body-regular text-text-secondary">{config.roles.length} peran tersedia. Admin adalah peran sistem.</p></div><Button leadingIcon={RiAddLine} onClick={startNew}>Tambah peran</Button></div>
        <div className="divide-y divide-separator-border">{config.roles.map((role) => <div key={role.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-body-medium text-text-primary">{role.name}</span>{role.isSystem && <Badge>Peran sistem</Badge>}<Badge>{role.accessLevel === "operator" ? "Operator" : role.accessLevel === "admin" ? "Admin" : "Viewer"}</Badge></div><p className="mt-1 text-caption-1-regular text-text-secondary">{role.menuKeys.map((key) => APP_MENU_DEFINITIONS.find((menu) => menu.key === key)?.label ?? key).join(" · ")} · {role.userCount} user</p></div><div className="flex items-center gap-2"><Button size="small" variant="secondary" leadingIcon={RiPencilLine} onClick={() => editRole(role)} disabled={role.accessLevel === "admin"}>Ubah</Button>{!role.isSystem && <ModalTrigger><Button size="small" variant="danger" leadingIcon={RiDeleteBinLine} disabled={role.userCount > 0}>Hapus</Button><AlertDialog title="Hapus peran?" description={role.userCount ? "Pindahkan user ke peran lain sebelum menghapus peran ini." : `Peran ${role.name} akan dihapus.`} confirmLabel="Hapus peran" cancelLabel="Batal" onConfirm={() => deleteRole(role)} /></ModalTrigger>}</div></div>)}</div>
      </Panel>

      <Panel className="p-5 sm:p-6">
        <div className="mb-5"><h2 className="text-title-2-medium text-text-primary">{selectedRole ? `Ubah ${selectedRole.name}` : "Tambah peran"}</h2><p className="mt-1 text-body-regular text-text-secondary">Pilih profil hak ubah data dan menu yang boleh dibuka.</p></div>
        <form onSubmit={(event) => void saveRole(event)} className="flex flex-col gap-5">
          <div className="grid gap-4 md:grid-cols-2"><Input label="Nama peran" value={roleName} onChange={setRoleName} isRequired placeholder="Contoh: Petugas inventaris" /><Input label="Deskripsi" value={description} onChange={setDescription} placeholder="Tugas atau batasan peran" /><Select label="Profil hak data" selectedKey={accessLevel} isDisabled={Boolean(selectedRole?.isSystem)} onSelectionChange={(key) => setAccessLevel(String(key) as "operator" | "viewer")}><SelectItem id="viewer">Viewer · lihat saja</SelectItem><SelectItem id="operator">Operator · kelola data operasional</SelectItem></Select></div>
          <div><h3 className="text-body-medium text-text-primary">Menu yang dapat dibuka</h3><div className="mt-2 grid gap-2 sm:grid-cols-2">{APP_MENU_DEFINITIONS.filter((menu) => menu.key !== "users").map((menu) => <Checkbox key={menu.key} size="sm" isSelected={menuKeys.includes(menu.key)} isDisabled={menu.key === "dashboard"} onChange={(checked) => setMenuKeys((current) => checked ? [...new Set([...current, menu.key])] : current.filter((key) => key !== menu.key))}>{menu.label}{menu.key === "dashboard" ? " · wajib" : ""}</Checkbox>)}</div></div>
          {notice && <p role="status" className="text-body-2-regular text-text-secondary">{notice}</p>}
          <div className="flex flex-wrap gap-2"><Button type="submit" disabled={!roleName.trim()}>Simpan peran</Button><Button type="button" variant="secondary" onClick={startNew}>Peran baru</Button></div>
        </form>
      </Panel>
    </div>
  );
}
