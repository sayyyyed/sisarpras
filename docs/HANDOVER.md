# Serah Terima — SI SARPRAS

Dokumen ini untuk agent/developer berikutnya. Isinya: kondisi nyata saat ini
(sudah diverifikasi), kontrak yang harus diikuti, daftar pekerjaan yang belum
selesai beserta kriteria selesainya, dan jebakan lingkungan yang sudah memakan
waktu.

Terakhir diperbarui: setelah "Tambah Ruangan" + sidebar sticky selesai.

---

## 1. Cara menjalankan

```powershell
# 1. Database (PostgreSQL 17.11 portable, di D:, tanpa Docker)
.\scripts\pg.ps1 start          # status | stop | info | psql | createdb
.\scripts\pg.ps1 info

# 2. Sekali saja / saat skema berubah
pnpm install
pnpm --filter @sisarpras/api db:migrate
pnpm --filter @sisarpras/api db:seed

# 3. Dua terminal
pnpm dev:api                    # http://localhost:8787
pnpm dev                        # http://localhost:5173
```

Kredensial dev: `postgres:postgres@localhost:5432/sisarpras`. Konfigurasi ada di
`apps/api/.env` (tidak di-commit).

## 2. Stack & struktur

| Bagian | Teknologi |
|---|---|
| UI | React 19.3 + Vite 8 + TypeScript 7 + Tailwind v4.3 |
| Komponen | BoardUI, **vendored** di `apps/client/src/components/` (bukan package) |
| Routing | React Router 7 |
| Validasi | Zod 4, dibagi lewat `packages/domain` |
| API | Hono 4.13 + `@hono/node-server`, tsx |
| ORM/DB | Drizzle ORM 0.45 + `postgres` 4, PostgreSQL 17.11 |
| Desktop | **belum ada** (Tauri belum dipasang) |

```
apps/client    UI
apps/api       Hono + Drizzle + skema Postgres  (12 tabel)
packages/domain  Tipe & skema Zod bersama
scripts/pg.ps1   Kontrol PostgreSQL portable
```

## 3. Yang SUDAH jalan (terverifikasi)

| Item | Bukti |
|---|---|
| PostgreSQL portable di D: | `pg_ctl status` → PID jalan; 863 MB binari + 48 MB cluster, **0 byte di C:** |
| Skema 12 tabel + migrasi | `migrations/0000_hard_stick.sql` diterapkan |
| Seed idempoten | 5 kategori, 6 lokasi, 5 aset, 4 jenis stok |
| `GET /health` | `ok` + versi PostgreSQL |
| `GET /v1/assets` | join nama kategori/ruangan, filter `q`/`categoryId`/`locationId`/`condition`/`status`/`limit`/`offset` |
| `POST /v1/assets` | 201; 409 kalau kode dobel; 400 + detail Zod kalau invalid |
| Tulis aset 1 transaksi | `assets` + `asset_events` + `sync_changes` bertambah bersamaan |
| `GET`/`POST /v1/locations` | ruangan baru masuk DB + `sync_changes` |
| UI ↔ API | halaman Aset menampilkan 6 baris dari Postgres (bukan mock) |
| Tambah Ruangan | modal BoardUI → tersimpan ke PostgreSQL, muncul di grid |
| Sidebar melekat | scroll konten 330px → nav `dy = 0.0`, `window.scrollY = 0` |
| Responsif | < lg: rail tersembunyi + drawer; scrim `oklab(0 0 0 / .5)` |
| `tsc` + `vite build` | bersih di api dan client (tidak ada error console) |

## 4. Kontrak yang harus diikuti

**Bentuk respons API** — selalu `{ data: ... }` untuk sukses; error
`{ error: "kode", detail?, issues? }` dengan status 400/409/422/503.

**Repository pattern** — UI tidak boleh tahu DB-nya apa.
`apps/client/src/lib/repositories/asset-repository.ts` mendefinisikan
`InventoryRepository` (`listAssets`, `createAsset`, `listCategories`,
`listLocations`, `createLocation`). Desktop nanti menambah
`SqliteInventoryRepository` tanpa mengubah halaman.

**Offline** — `ApiError.status === 0` berarti request tidak sampai server.
Store menandai ini dan menyimpan perubahan lokal + entri `outbox`; status bar
menampilkan "Mode lokal". Error 4xx **tidak boleh** dipalsukan jadi sukses.

**Skema Zod dipakai di dua sisi** — API memvalidasi body dengan skema yang sama
yang dipakai form. Jangan bikin validasi terpisah.

**Aturan BoardUI** (ada di `apps/client/AGENTS.md` + `.cursor/rules/boardui.mdc`):
token semantik saja (`bg-background-primary-default`, `text-text-secondary`),
utilitas tipe gabungan (`text-title-2-medium`, `text-body-regular`), gabung class
dengan `cx()` dari `@/utils/cx`, ikon dari `@remixicon/react` sebagai referensi
komponen. **Jangan** bikin komponen pengganti kalau registry sudah punya.

**Soft delete** — aset tidak pernah dihapus fisik, hanya `deleted_at`.

## 5. Yang BELUM — daftar kerja

### P0 — menghalangi rilis

**5.1 Autentikasi + RBAC**
- Tabel `users` **sudah ada** (`email`, `name`, `role` enum admin/operator/viewer, `passwordHash`, `isActive`) tapi belum dipakai.
- Perlu: `POST /v1/auth/login` (argon2/bcrypt), `GET /v1/auth/me`, middleware Hono yang menempelkan `actorId`, dan otorisasi per-role di setiap route (`viewer` tidak boleh menulis).
- Sudah ada hook: `createAsset(draft, { actorId })` dan `asset_events.actorId` siap diisi.
- Selesai kalau: request tanpa token → 401; `viewer` POST → 403; `asset_events.actorId` terisi.
- Jebakan: kredensial disimpan lewat secure storage OS, bukan SQLite/plaintext.

**5.2 Sinkronisasi push/pull**
- `GET /v1/sync/status` baru mengembalikan kursor; `pushEnabled`/`pullEnabled` masih `false`.
- Perlu: `POST /v1/sync/push` (terima array mutasi, cek `processed_mutations` untuk idempotensi, bandingkan `baseVersion` → 409 `conflict`, tulis dalam transaksi) dan `GET /v1/sync/pull?cursor=` (baca `sync_changes` berurutan berdasarkan `seq`, bukan jam perangkat).
- Tabelnya sudah ada: `sync_changes` (`seq` identity = kursor), `processed_mutations`, `devices`.
- Selesai kalau: mutasi dobel tidak diterapkan dua kali; konflik versi menghasilkan response konflik, bukan menimpa diam-diam; pull terputus bisa dilanjutkan dari kursor.

**5.3 Shell desktop Tauri + SQLite** ← inti proyek
- Prasyarat sistem sudah lengkap: Rust 1.99.1 MSVC, Windows SDK 10.0.26100, WebView2 156, MSVC `cl.exe` 14.44.
- Perlu: `pnpm --filter @sisarpras/client add -D @tauri-apps/cli`, `tauri init` (frontendDist `../dist`, devUrl `http://localhost:5173`, beforeDev `pnpm dev`, beforeBuild `pnpm build`), `tauri add sql`, `cargo add tauri-plugin-sql --features sqlite`, migrasi di `src-tauri/migrations/001_initial.sql`, izin di `src-tauri/capabilities/default.json`.
- **Ganti `BrowserRouter` → `HashRouter`** di `src/main.tsx`: Tauri menyajikan app dari custom protocol, refresh di `/assets` bisa 404.
- Tambah `SqliteInventoryRepository` untuk `InventoryRepository`.
- Selesai kalau: jendela Windows native terbuka, tambah aset saat **kabel jaringan dicabut** tetap tersimpan dan bertahan setelah aplikasi ditutup, dan `sync_outbox` berisi entri pending.

### P1 — melengkapi fitur

**5.4 Stok habis pakai** — tabel `stock_items` + `stock_movements` sudah ada, tapi belum ada route. Halaman `/stock` masih data contoh (`apps/client/src/data/mock.ts`). Perlu `GET /v1/stock-items`, `POST /v1/stock-movements` (append-only, `transactionId` unik, update `quantity` dalam transaksi yang sama).

**5.5 Pengadaan** — tabelnya **belum ada**. Perlu tabel `procurement_requests` (reference, itemName, quantity, vendor, proposedPriceIdr, approvedPriceIdr, requestedAt, status enum draft/submitted/approved/rejected/received) + relasi kuitansi. Halaman `/procurement` masih data contoh, modalnya belum menyimpan apa pun.

**5.6 Lampiran berkas** — tabel `attachments` ada, `FileUpload` sudah dipasang di UI, tapi belum ada endpoint unggah maupun object storage. Perlu keputusan penyimpanan (S3/R2/lokal) sebelum dikerjakan.

**5.7 Laporan** — halaman `/reports` masih tombol tanpa aksi. Perlu ekspor CSV/Excel/PDF dari data nyata.

**5.8 Label & barcode** — halaman `/labels` memakai SVG QR **dekoratif dan deterministik** (`PreviewCode` di `labels-page.tsx`). Perlu encoder QR asli (mis. `qrcode`), payload URL/UUID stabil, dan unggah logo sungguhan.

### P2 — kualitas

- **5.9 `git init`** — repo **belum ada sama sekali**; belum ada commit, branch, maupun `.gitattributes`. `.gitignore` sudah siap.
- **5.10 Pengujian** — belum ada Vitest/Playwright. Prioritas: validasi Zod di domain, idempotensi sync, dan alur tambah aset.
- **5.11 Daftar aset** — masih `table` React Aria statis + paginasi klien. Komponen `data-table` (TanStack) sudah ter-install tapi belum dipakai; pindahkan sorting/filter/paginasi ke server saat data membesar.
- **5.12 Berkas sampah** — `apps/client/package-lock.json` (dibuat CLI BoardUI saat memakai npm; salah untuk workspace pnpm) dan `.build-check.log` di root. Belum dihapus karena ada instruksi "jangan hapus apa pun" dari pemilik proyek.

## 6. Jebakan lingkungan (sudah kejadian, jangan diulang)

| Jebakan | Detail |
|---|---|
| **C: hampir penuh** | ~5 GB dari 197 GB. Jangan install Docker Desktop, jangan install apa pun ke C:. PostgreSQL sengaja portable di D:. |
| **`scripts/pg.ps1` wajib ASCII** | PowerShell 5.1 membaca file tanpa BOM sebagai ANSI; em dash (UTF-8 `0x94`) jadi kutip melengkung yang dianggap penutup string → parse error di baris lain. Sudah pernah kejadian. |
| **`pg.ps1 start` harus detached** | `pg_ctl start` yang dijalankan langsung membuat proses induk menunggu selamanya; kalau di-kill, server ikut mati (`0xC0000142`). Gunakan `Start-Process -WindowStyle Hidden` seperti yang sudah ada. |
| **TypeScript 7 membuang `baseUrl`** | `tsconfig` hanya boleh pakai `paths` (relatif ke tsconfig). Ini pernah membuat `tsc` gagal dan `&&` memutus `vite build` sehingga `dist/` tidak terbentuk padahal exit code 0. |
| **Output pnpm tidak tertangkap** | Di shell ini output `pnpm` sering kosong. Verifikasi lewat file langsung (`node node_modules/.../tsc --noEmit`) dan cek artefaknya, jangan percaya exit code saja. |
| **BoardUI adalah Next.js-first** | 2 file sudah dipatch: `components/base/breadcrumb/breadcrumb.tsx` (`next/link` → `<a>`) dan `dashboard-user-menu.tsx` (impor tipe tak terpakai). String demo BoardUI sudah dilokalkan ke bahasa Indonesia. Patch lagi kalau ada impor Next lain. |
| **`<aside>` ganda** | Wrapper kita + milik `DashboardSidebar`. Untuk selektor uji, pakai `[data-sidebar-rail]` dan `[data-app-main]`. |
| **Indeks RLS/Supabase** | Saat pindah ke Supabase, `src/db/client.ts` otomatis: SSL kalau host bukan localhost, dan `prepare: false` kalau lewat pooler `:6543`. Tidak perlu ubah kode, cuma `DATABASE_URL`. |

## 7. Urutan yang disarankan

1. **5.3 Tauri + SQLite** — inti offline-first; prasyarat sistem sudah lengkap.
2. **5.4 + 5.5** — habiskan sisa data contoh supaya tidak ada mock yang tertinggal.
3. **5.1 Auth** — sebelum ada pengguna nyata.
4. **5.2 Sync** — setelah desktop punya outbox asli.
5. **5.9 `git init`** — sebaiknya justru dilakukan lebih awal, sebelum perubahan besar.
6. **5.6 / 5.7 / 5.8** — fitur pelengkap.
7. **5.10–5.12** — pengujian dan kerapian.

## 8. Berkas penting

| Berkas | Kenapa penting |
|---|---|
| `apps/api/src/db/schema.ts` | Sumber kebenaran 12 tabel. Ubah di sini → `db:generate` → `db:migrate`. |
| `apps/client/src/lib/store.tsx` | Satu-satunya tempat data masuk ke UI; di sinilah satu-satunya impor `@/data/mock` yang tersisa. |
| `apps/client/src/lib/repositories/asset-repository.ts` | Kontrak repository yang harus dipenuhi versi SQLite desktop. |
| `packages/domain/src/index.ts` | Skema Zod + label; dipakai bersama client & API. |
| `apps/client/src/components/layout/app-shell.tsx` | Layout: sidebar melekat, drawer mobile, status bar. |
| `scripts/pg.ps1` | Satu-satunya cara DB lokal dinyalakan. |

---

## 9. Catatan: kerja paralel

Repo ini **sedang dikerjakan lebih dari satu agent**. Saat dokumen ini ditulis,
agent lain sudah menambahkan (dengan stempel waktu 14:32–14:41):

- `apps/api/src/routes/auth.ts`, `middleware/auth.ts`, `lib/password.ts`, `lib/tokens.ts`
- `apps/client/src/lib/auth.tsx`, `desktop-storage.ts`
- perubahan pada `db/schema.ts`, `repositories/assets.ts`, `repositories/locations.ts`,
  `routes/assets.ts`, `routes/locations.ts`, `routes/sync.ts`, `db/seed.ts`,
  `apps/api/src/index.ts`, `apps/client/src/lib/store.tsx`, `lib/api.ts`, `domain/index.ts`

Artinya **sebagian item P0 di atas mungkin sudah dikerjakan**. Sebelum mulai,
periksa dulu isi file-file tersebut — jangan menulis ulang dari nol.

Sisa pekerjaan stok yang setengah jadi (per 17:52):

- `packages/domain`: `StockMovementDraftSchema` / `StockMovementDraft` — **sudah ditambahkan**
- `apps/api/src/repositories/stock.ts` — ada (`listStockItems`, `createStockMovement`, `listStockMovements`)
- `apps/api/src/routes/stock.ts` — ada, **belum di-mount** di `index.ts` (sengaja, supaya tidak
  bertabrakan dengan route yang mungkin sedang ditambah agent lain)
- `apps/client`: belum disambungkan; halaman `/stock` masih memakai `@/data/mock`

Langkah melengkapi: mount `app.route("/v1/stock", stockRoute)` di `apps/api/src/index.ts`,
tambah `listStockItems`/`createStockMovement` ke `InventoryRepository`, lalu sambungkan
`features/stock/stock-page.tsx` dan tombol "Catat Mutasi".

---

## 10. UPDATE — bagian 1–9 di atas sudah kedaluwarsa sebagian

Agent paralel sudah berhenti. Kondisi terbaru (diverifikasi):

**Sudah selesai (jangan dikerjakan ulang):**

- **Auth** — PIN 6 digit. `POST /v1/auth/login` body `{ pin }` → `{ token, user }`. Token
  Bearer disimpan di `localStorage["sisarpras.api-token.v1"]` dan otomatis dipasang oleh
  `apiRequest()` di `lib/api.ts`. Middleware `requireAuth` / `requireRole("admin","operator")`
  ada di `apps/api/src/middleware/auth.ts`. Manajemen pengguna admin-only: `GET/POST
  /v1/auth/users` + halaman `/users`. PIN admin dev: **`898851`** (env `INITIAL_ADMIN_PIN`).
  Pola route: GET → `requireAuth`, POST tulis → `requireAuth, requireRole("admin","operator")`.
- **Sinkronisasi** — `POST /v1/sync/push` dan `GET /v1/sync/pull` aktif
  (`pushEnabled/pullEnabled = true`). Store punya `syncNow()` yang push outbox lalu pull
  perubahan per `seq` dan menyimpan kursor di `sisarpras.sync-cursor.v1`.
- **Tauri** — `apps/client/src-tauri` sudah ada; `@tauri-apps/api`, `@tauri-apps/cli`,
  `@tauri-apps/plugin-sql` terpasang. `lib/desktop-storage.ts` menulis cache aset, kategori,
  lokasi, stok, outbox, dan kursor ke SQLite desktop (`sqlite:sisarpras.db`).
- **Migrasi** — `0000_hard_stick.sql` + `0001_auth_and_sync.sql`, keduanya sudah diterapkan.
- **Stok** — SELESAI. `GET /v1/stock`, `GET /v1/stock/:id/movements`,
  `POST /v1/stock/movements` (append-only; 201 sukses, **409** kalau `transactionId` dobel,
  **422** kalau stok jadi negatif). `InventoryRepository` sudah punya `listStockItems` /
  `createStockMovement`; halaman `/stock` + modal "Catat Mutasi" tersambung ke API dengan
  fallback offline (optimistic + masuk outbox).
- `git init` sudah dijalankan, **tetapi belum ada satu commit pun**.

**Bukti uji stok:** login PIN → `GET /v1/stock` tanpa token = 401, dengan token = 4 item;
mutasi −5 → 201 (qty 42→37); `transactionId` sama → 409; melebihi stok → 422; lewat UI
"Catat Mutasi" masuk 3 → tabel berubah 35→38 dan `stock_movements` bertambah.

**Sisa pekerjaan yang sebenarnya (revisi bagian 5):**

| Prioritas | Pekerjaan |
|---|---|
| P1 | **Pengadaan + kuitansi** — tabel `procurement_requests` belum ada, endpoint belum ada, modal "Buat Pengajuan" masih belum menyimpan |
| P1 | **Lampiran berkas** — tabel `attachments` ada, dropzone ada, tetapi tidak ada endpoint unggah maupun object storage |
| P1 | **QR/barcode asli + unggah logo** — `/labels` masih memakai SVG dekoratif |
| P2 | **Laporan** — ekspor CSV/Excel/PDF belum ada |
| P2 | **Repository aset masih API-only** — SQLite desktop baru dipakai untuk cache auth/sesi, jadi offline-first untuk aset belum utuh; `tauri dev` juga belum diverifikasi |
| P2 | **Tes otomatis** (Vitest/Playwright) dan commit pertama |


