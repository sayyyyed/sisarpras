import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiError, apiRequest } from "@/lib/api";
import { desktopDatabase } from "@/lib/desktop-storage";
import { DEFAULT_ROLE_MENU_KEYS } from "@sisarpras/domain";

export type UserRole = "admin" | "operator" | "viewer";
export interface LocalUser { id: string; name: string; role: UserRole; roleId?: string; roleName?: string; menuKeys?: string[]; pinHash?: string; createdAt: string; isActive?: boolean; }
interface PublicUser extends Omit<LocalUser, "pinHash"> {}
interface SessionResponse { token: string; user: PublicUser; }
interface AuthState {
  users: LocalUser[];
  user: LocalUser | null;
  ready: boolean;
  login: (pin: string) => Promise<boolean>;
  logout: () => void;
  addUser: (name: string, roleId: string, pin: string) => Promise<void>;
  updateUser: (id: string, patch: Partial<Pick<LocalUser, "name" | "roleId">> & { pin?: string }) => Promise<void>;
  removeUser: (id: string) => Promise<void>;
  refreshCurrentUser: () => Promise<void>;
}

const USERS_KEY = "sisarpras.users.v1";
const SESSION_KEY = "sisarpras.session.v1";
const SESSION_USER_KEY = "sisarpras.session-user.v1";
const TOKEN_KEY = "sisarpras.api-token.v1";
const ROLES_KEY = "sisarpras.roles.v1";
const AuthContext = createContext<AuthState | null>(null);

const DEFAULT_ROLE_IDS: Record<UserRole, string> = {
  admin: "00000000-0000-4000-8000-000000000001",
  operator: "00000000-0000-4000-8000-000000000002",
  viewer: "00000000-0000-4000-8000-000000000003",
};

function normalizeLocalUser(user: LocalUser): LocalUser {
  const roleMenus = user.menuKeys ?? DEFAULT_ROLE_MENU_KEYS[user.role];
  let menuKeys = roleMenus;
  try {
    const menuState = JSON.parse(localStorage.getItem("sisarpras.menu-state.v1") ?? "null") as Array<{ key: string; enabled: boolean }> | null;
    if (menuState) {
      const enabled = new Set(menuState.filter((menu) => menu.enabled || menu.key === "dashboard" || menu.key === "users").map((menu) => menu.key));
      menuKeys = roleMenus.filter((key) => enabled.has(key));
    }
  } catch { /* Use the last cached role menu list. */ }
  return {
    ...user,
    roleId: user.roleId ?? DEFAULT_ROLE_IDS[user.role],
    roleName: user.roleName ?? ({ admin: "Admin", operator: "Operator", viewer: "Viewer" }[user.role]),
    menuKeys,
  };
}

function cachedRole(roleId: string): { name: string; accessLevel: UserRole; menuKeys: string[] } | undefined {
  try {
    const roles = JSON.parse(localStorage.getItem(ROLES_KEY) ?? "[]") as Array<{ id: string; name: string; accessLevel: UserRole; menuKeys: string[] }>;
    return roles.find((role) => role.id === roleId);
  } catch { return undefined; }
}

async function legacyHashPin(pin: string): Promise<string> {
  const bytes = new TextEncoder().encode(pin);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const digest = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 310_000 }, key, 256));
  const toHex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `pbkdf2:${toHex(salt)}:${toHex(digest)}`;
}

async function verifyPin(pin: string, encoded: string): Promise<boolean> {
  if (!encoded.startsWith("pbkdf2:")) return encoded === await legacyHashPin(pin);
  const [, saltHex, expected] = encoded.split(":");
  if (!saltHex || !expected) return false;
  const salt = new Uint8Array(saltHex.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? []);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const digest = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 310_000 }, key, 256));
  const actual = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return actual === expected;
}

function readCachedUser(): PublicUser | null {
  try {
    const saved = localStorage.getItem(SESSION_USER_KEY);
  return saved ? normalizeLocalUser(JSON.parse(saved) as PublicUser) : null;
  } catch {
    return null;
  }
}

async function readLocalUsers(): Promise<LocalUser[]> {
  const db = await desktopDatabase();
  if (!db) {
    try {
      const saved = localStorage.getItem(USERS_KEY);
      return saved ? JSON.parse(saved) as LocalUser[] : [];
    } catch { return []; }
  }
  const rows = await db.select<Array<{ id: string; name: string; role: UserRole; role_id: string | null; role_name: string | null; menu_keys_json: string | null; pin_hash: string; created_at: string; is_active: number }>>(
    "SELECT id, name, role, role_id, role_name, menu_keys_json, pin_hash, created_at, is_active FROM users ORDER BY created_at",
  );
  return rows.map((row) => normalizeLocalUser({ id: row.id, name: row.name, role: row.role, roleId: row.role_id ?? undefined, roleName: row.role_name ?? undefined, menuKeys: row.menu_keys_json ? JSON.parse(row.menu_keys_json) as string[] : undefined, pinHash: row.pin_hash, createdAt: row.created_at, isActive: row.is_active === 1 }));
}

async function writeLocalUsers(users: LocalUser[]): Promise<void> {
  const db = await desktopDatabase();
  if (!db) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    return;
  }
  for (const user of users) {
    if (!user.pinHash) continue;
    await db.execute(
      "INSERT INTO users (id, name, role, role_id, role_name, menu_keys_json, pin_hash, created_at, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT(id) DO UPDATE SET name = excluded.name, role = excluded.role, role_id = excluded.role_id, role_name = excluded.role_name, menu_keys_json = excluded.menu_keys_json, pin_hash = excluded.pin_hash, is_active = excluded.is_active",
      [user.id, user.name, user.role, user.roleId, user.roleName, JSON.stringify(user.menuKeys ?? []), user.pinHash, user.createdAt, user.isActive === false ? 0 : 1],
    );
  }
  const existing = await db.select<Array<{ id: string }>>("SELECT id FROM users");
  const keep = new Set(users.map((user) => user.id));
  for (const row of existing) if (!keep.has(row.id)) await db.execute("DELETE FROM users WHERE id = $1", [row.id]);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<LocalUser[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sessionUser, setSessionUser] = useState<PublicUser | null>(null);
  const [ready, setReady] = useState(false);

  const refreshRemoteUsers = useCallback(async () => {
    const result = await apiRequest<{ data: PublicUser[] }>("/v1/auth/users");
    setUsers(result.data);
  }, []);

  const refreshCurrentUser = useCallback(async () => {
    const result = await apiRequest<{ user: PublicUser }>("/v1/auth/me");
    setSessionUser(result.user);
    localStorage.setItem(SESSION_USER_KEY, JSON.stringify(result.user));
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      let stored = await readLocalUsers();
      if (!stored.length) {
        stored = [normalizeLocalUser({ id: crypto.randomUUID(), name: "Admin", role: "admin", pinHash: await hashPin("898851"), createdAt: new Date().toISOString(), isActive: true })];
      }
      if (!active) return;
      await writeLocalUsers(stored);
      setUsers(stored);

      const token = localStorage.getItem(TOKEN_KEY);
      const cachedUser = readCachedUser();
      if (token && cachedUser) {
        try {
          const result = await apiRequest<{ user: PublicUser }>("/v1/auth/me");
          if (!active) return;
          setSessionUser(result.user);
          setActiveId(result.user.id);
          if (result.user.role === "admin") await refreshRemoteUsers();
        } catch {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(SESSION_USER_KEY);
          localStorage.removeItem(SESSION_KEY);
        }
      } else {
        const session = localStorage.getItem(SESSION_KEY);
        if (stored.some((item) => item.id === session)) setActiveId(session);
      }
      if (active) setReady(true);
    })();
    return () => { active = false; };
  }, [refreshRemoteUsers]);

  const persistLocal = useCallback(async (next: LocalUser[]) => {
    setUsers(next);
    await writeLocalUsers(next);
  }, []);

  const value = useMemo<AuthState>(() => ({
    users,
    user: sessionUser ?? users.find((item) => item.id === activeId) ?? null,
    ready,
    refreshCurrentUser,
    login: async (pin) => {
      try {
        const result = await apiRequest<SessionResponse>("/v1/auth/login", {
          method: "POST",
          body: JSON.stringify({ pin }),
        }, { skipAuth: true });
        localStorage.setItem(TOKEN_KEY, result.token);
        localStorage.setItem(SESSION_USER_KEY, JSON.stringify(result.user));
        localStorage.setItem(SESSION_KEY, result.user.id);
        setSessionUser(result.user);
        setActiveId(result.user.id);
        if (result.user.role === "admin") await refreshRemoteUsers();
        return true;
      } catch (cause) {
        if (!(cause instanceof ApiError) || !cause.isOffline) return false;
        localStorage.removeItem(TOKEN_KEY);
        let match: LocalUser | undefined;
        for (const item of users) {
          if (item.isActive !== false && item.pinHash && await verifyPin(pin, item.pinHash)) { match = item; break; }
        }
        if (!match) return false;
        setSessionUser(null);
        localStorage.setItem(SESSION_KEY, match.id);
        setActiveId(match.id);
        return true;
      }
    },
    logout: () => {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(SESSION_USER_KEY);
      localStorage.removeItem(SESSION_KEY);
      setSessionUser(null);
      setActiveId(null);
    },
    addUser: async (name, roleId, pin) => {
      if (localStorage.getItem(TOKEN_KEY)) {
        const result = await apiRequest<{ data: PublicUser }>("/v1/auth/users", {
          method: "POST",
          body: JSON.stringify({ name, roleId, pin }),
        });
        setUsers((current) => [...current.filter((item) => item.id !== result.data.id), result.data]);
        return;
      }
      const assigned = cachedRole(roleId);
      if (!assigned) throw new Error("Peran belum tersimpan di perangkat. Hubungkan internet untuk menambah user.");
      await persistLocal([...users, normalizeLocalUser({ id: crypto.randomUUID(), name: name.trim(), role: assigned.accessLevel, roleId, roleName: assigned.name, menuKeys: assigned.menuKeys, pinHash: await hashPin(pin), createdAt: new Date().toISOString(), isActive: true })]);
    },
    updateUser: async (id, patch) => {
      if (localStorage.getItem(TOKEN_KEY)) {
        const result = await apiRequest<{ data: PublicUser }>(`/v1/auth/users/${id}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        });
        setUsers((current) => current.map((item) => item.id === id ? result.data : item));
        if (sessionUser?.id === id) {
          setSessionUser(result.data);
          localStorage.setItem(SESSION_USER_KEY, JSON.stringify(result.data));
        }
        return;
      }
      const next = await Promise.all(users.map(async (item) => item.id !== id ? item : {
        ...item,
        ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
        ...(patch.roleId ? { roleId: patch.roleId, ...(cachedRole(patch.roleId) ? { role: cachedRole(patch.roleId)!.accessLevel, roleName: cachedRole(patch.roleId)!.name, menuKeys: cachedRole(patch.roleId)!.menuKeys } : {}) } : {}),
        ...(patch.pin ? { pinHash: await hashPin(patch.pin) } : {}),
      }));
      await persistLocal(next);
    },
    removeUser: async (id) => {
      if (localStorage.getItem(TOKEN_KEY)) {
        await apiRequest(`/v1/auth/users/${id}`, { method: "DELETE" });
      }
      await persistLocal(users.filter((item) => item.id !== id));
    },
  }), [users, activeId, sessionUser, ready, refreshRemoteUsers, refreshCurrentUser, persistLocal]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth harus dipakai di dalam <AuthProvider>");
  return context;
}
