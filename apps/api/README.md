# @sisarpras/api

API Hono + Drizzle ORM di atas PostgreSQL.

## Database lokal (portable, di D:)

Tidak pakai Docker dan tidak menulis apa pun ke C:. Binari PostgreSQL 17.11
diekstrak ke `D:\pgsql\pgsql`, cluster ada di `D:\pgsql\data`.

```powershell
.\scripts\pg.ps1 info        # lihat konfigurasi
.\scripts\pg.ps1 init        # initdb (sekali saja, tidak menimpa data lama)
.\scripts\pg.ps1 start       # nyalakan (detached, aman ditutup terminalnya)
.\scripts\pg.ps1 status
.\scripts\pg.ps1 createdb    # buat database sisarpras
.\scripts\pg.ps1 psql        # sesi psql interaktif
.\scripts\pg.ps1 stop
```

Kredensial dev: `postgres` / `postgres` di `localhost:5432`, database `sisarpras`.
Port diambil dari `postgresql.conf` cluster.

> Catatan: `scripts/pg.ps1` harus tetap **ASCII-only**. Windows PowerShell 5.1
> membaca file tanpa BOM sebagai ANSI, sehingga tanda baca UTF-8 (em dash,
> kutip melengkung) bisa salah di-parse.

## Konfigurasi

`apps/api/.env` (tidak di-commit):

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sisarpras
PORT=8787
```

Untuk Supabase, cukup ganti `DATABASE_URL` — lihat `README.md` di root.
SSL dan opsi pooler dideteksi otomatis dari URL.
`AUTH_TOKEN_SECRET` harus berupa rahasia acak dan tetap sama saat API di-restart.

## Alur skema

```powershell
pnpm --filter @sisarpras/api db:generate   # ubah src/db/schema.ts -> file migrasi
pnpm --filter @sisarpras/api db:migrate    # terapkan ke database
pnpm --filter @sisarpras/api db:seed       # data contoh (idempoten)
pnpm --filter @sisarpras/api db:studio     # GUI
```

## Tabel

| Tabel | Isi |
|---|---|
| `users` | Akun + peran (`admin`/`operator`/`viewer`) |
| `asset_categories` | Klasifikasi aset |
| `locations` | Gedung / lantai / ruangan / gudang (hierarkis) |
| `assets` | Aset tetap, dengan `version` untuk optimistic concurrency |
| `asset_assignments` | Riwayat pemegang aset |
| `asset_events` | Audit append-only: siapa, operasi, nilai sebelum/sesudah |
| `stock_items` | Barang habis pakai |
| `stock_movements` | Mutasi stok append-only (bukan menimpa angka) |
| `attachments` | Metadata berkas; byte-nya di object storage |
| `devices` | Instalasi desktop terdaftar |
| `sync_changes` | Feed perubahan server; `seq` = kursor untuk pull |
| `processed_mutations` | Penjaga idempotensi (mutation_id tidak boleh dobel) |

Aset **tidak pernah dihapus fisik** — hanya `deleted_at` (soft delete) supaya
riwayat audit tetap utuh.

## Endpoint

| Method | Path | Keterangan |
|---|---|---|
| GET | `/health` | Status + versi DB (503 kalau DB mati) |
| GET | `/v1/assets` | Daftar aset + nama kategori/ruangan. Filter: `q`, `categoryId`, `locationId`, `condition`, `status`, `limit`, `offset` |
| POST | `/v1/assets` | Buat aset (admin/operator; validasi Zod; tulis aset + audit + feed dalam satu transaksi) |
| GET | `/v1/assets/categories` | Daftar kategori |
| GET | `/v1/assets/locations` | Daftar lokasi |
| GET | `/v1/assets/meta` | Label kondisi & status (untuk UI) |
| GET | `/v1/sync/status` | Kursor sinkronisasi |
| POST | `/v1/auth/login` | Login dengan PIN enam digit; menghasilkan bearer token berlaku 12 jam |
| GET | `/v1/auth/me` | User dari token aktif |
| GET/POST | `/v1/auth/users` | Daftar/buat akun (admin) |
| PATCH/DELETE | `/v1/auth/users/:id` | Ubah nama/peran/PIN atau nonaktifkan akun (admin) |
| POST | `/v1/sync/push` | Kirim batch mutation; admin/operator; idempotensi lewat `mutationId` |
| GET | `/v1/sync/pull?since=0&limit=200` | Baca change feed setelah cursor; semua role yang login |

`POST /v1/sync/push` menerima `{ deviceId, deviceName?, platform?, mutations }`.
Mutation saat ini mendukung entitas `asset` dan `location`; konflik versi dikembalikan
per mutation tanpa menimpa perubahan server. Jalankan `db:seed` setelah migrasi untuk
membuat admin awal. Nilai PIN awal dari `INITIAL_ADMIN_PIN` (default `898851`).
