# SI SARPRAS — Sistem Informasi Sarana & Prasarana

Manajemen aset, ruangan, stok habis pakai, pengadaan, label/barcode, dan sinkronisasi
offline-first. Satu basis kode UI untuk **desktop (Tauri)** dan **web**.

## Stack

| Bagian | Teknologi |
|---|---|
| UI | React 19 + Vite 8 + TypeScript 7 + Tailwind v4 |
| Komponen | [BoardUI](https://www.boardui.com) (sumber di `apps/client/src/components/`) |
| Routing | React Router 7 |
| Validasi | Zod (dibagi lewat `packages/domain`) |
| API | Hono + Node |
| DB server | PostgreSQL 17.11 portable di `D:\pgsql` (dev) |
| DB online | Supabase (nanti) |
| Desktop | Tauri 2 + SQLite (database aplikasi di folder data aplikasi OS) |

## Struktur

```
apps/
  client/   UI (React + Vite + BoardUI)
  api/      Hono API + Drizzle ORM + skema Postgres
packages/
  domain/   Tipe & skema Zod yang dipakai bersama client dan API
scripts/
  pg.ps1    Kontrol PostgreSQL portable
docs/
```

## Menjalankan

### 1. Database (PostgreSQL portable, tanpa Docker)

```powershell
.\scripts\pg.ps1 start      # nyalakan
.\scripts\pg.ps1 status     # cek
.\scripts\pg.ps1 stop       # matikan
```

Cluster tinggal di `D:\pgsql\data` — tidak ada service Windows, tidak ada admin,
tidak ada yang ditulis ke C:. Lihat `apps/api/README.md` untuk detail.

### 2. API

```powershell
pnpm install
pnpm --filter @sisarpras/api db:migrate   # tabel (sekali saja / saat skema berubah)
pnpm --filter @sisarpras/api db:seed      # data contoh (idempoten)
pnpm dev:api                              # http://localhost:8787
```

### 3. UI

```powershell
pnpm dev                                  # http://localhost:5173
```

### 4. Desktop Tauri

Pasang toolchain Rust dan dependensi platform Tauri 2 terlebih dahulu, lalu:

```powershell
pnpm dev:desktop
```

Paket Windows:

```powershell
pnpm --filter @sisarpras/client tauri:build
```

Client desktop memakai SQLite untuk akun offline, aset, lokasi, kategori, dan outbox.
Perubahan lokal dikirim melalui endpoint sync saat API dapat diakses.

## Skrip berguna

| Perintah | Fungsi |
|---|---|
| `pnpm dev` | Jalankan UI |
| `pnpm dev:api` | Jalankan API |
| `pnpm dev:desktop` | Jalankan shell Tauri |
| `pnpm build` | Build semua paket |
| `pnpm --filter @sisarpras/api db:generate` | Buat file migrasi dari perubahan skema |
| `pnpm --filter @sisarpras/api db:migrate` | Terapkan migrasi |
| `pnpm --filter @sisarpras/api db:studio` | Drizzle Studio (GUI DB) |
| `pnpm --filter @sisarpras/api db:seed` | Isi data contoh |

## Pindah ke Supabase (nanti)

Tidak ada kode yang perlu diubah. Cukup tukar `DATABASE_URL` di `apps/api/.env`:

```env
DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
```

`apps/api/src/db/client.ts` otomatis:
- memakai SSL kalau host bukan localhost, dan
- mematikan prepared statements kalau lewat pooler (`:6543`), karena pgbouncer
  mode transaction tidak mendukungnya.

Setelah itu jalankan `pnpm --filter @sisarpras/api db:migrate` ke database Supabase.

## Status

- [x] UI lengkap (BoardUI) — dashboard, aset, ruangan, pengadaan, label, stok, sinkronisasi, laporan, pengaturan
- [x] PostgreSQL portable lokal + skema 12 tabel + migrasi
- [x] API: PIN auth, role admin/operator/viewer, pengelolaan user, aset/lokasi
- [x] Sync API: push idempoten dan pull berbasis cursor dengan kontrol konflik versi
- [x] Shell Tauri 2 + SQLite lokal dan outbox persisten
- [ ] UI masih memakai data contoh di `apps/client/src/data/mock.ts` → ganti ke repository adapter
