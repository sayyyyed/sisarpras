use image::DynamicImage;
use serde::Serialize;
use std::io::Cursor;

const MAX_INPUT_BYTES: usize = 20 * 1024 * 1024;
const MAX_IMAGE_EDGE: u32 = 1600;
const JPEG_QUALITY: u8 = 82;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CompressedImage {
    bytes: Vec<u8>,
    mime_type: &'static str,
    width: u32,
    height: u32,
}

#[tauri::command]
fn compress_image(bytes: Vec<u8>) -> Result<CompressedImage, String> {
    if bytes.is_empty() || bytes.len() > MAX_INPUT_BYTES {
        return Err("Ukuran gambar harus di antara 1 byte dan 20 MB.".into());
    }

    let orientation = exif::Reader::new()
        .read_from_container(&mut Cursor::new(&bytes))
        .ok()
        .and_then(|exif| exif.get_field(exif::Tag::Orientation, exif::In::PRIMARY).cloned())
        .and_then(|field| field.value.get_uint(0))
        .unwrap_or(1);

    let mut image = image::load_from_memory(&bytes)
        .map_err(|_| "Format gambar tidak didukung. Gunakan JPEG, PNG, atau WebP.".to_string())?;
    image = match orientation {
        2 => image.fliph(),
        3 => image.rotate180(),
        4 => image.flipv(),
        5 => image.rotate90().fliph(),
        6 => image.rotate90(),
        7 => image.rotate270().fliph(),
        8 => image.rotate270(),
        _ => image,
    };
    image = image.thumbnail(MAX_IMAGE_EDGE, MAX_IMAGE_EDGE);
    let (width, height) = (image.width(), image.height());

    // JPEG has broad browser and storage compatibility; flatten transparency on white.
    let rgba = image.to_rgba8();
    let rgb = image::RgbImage::from_fn(width, height, |x, y| {
        let pixel = rgba.get_pixel(x, y).0;
        let alpha = u16::from(pixel[3]);
        image::Rgb(std::array::from_fn(|channel| {
            ((u16::from(pixel[channel]) * alpha + 255 * (255 - alpha)) / 255) as u8
        }))
    });
    let mut output = Cursor::new(Vec::new());
    image::codecs::jpeg::JpegEncoder::new_with_quality(&mut output, JPEG_QUALITY)
        .encode_image(&DynamicImage::ImageRgb8(rgb))
        .map_err(|_| "Gambar gagal dikompresi.".to_string())?;

    Ok(CompressedImage { bytes: output.into_inner(), mime_type: "image/jpeg", width, height })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![compress_image])
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(
                    "sqlite:sisarpras.db",
                    vec![
                        tauri_plugin_sql::Migration {
                            version: 1,
                            description: "create_local_users",
                            sql: "CREATE TABLE users (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('admin','operator','viewer')), pin_hash TEXT NOT NULL, created_at TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1);",
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 2,
                            description: "create_local_assets",
                            sql: "CREATE TABLE assets (id TEXT PRIMARY KEY NOT NULL, asset_code TEXT NOT NULL, name TEXT NOT NULL, category_id TEXT NOT NULL, location_id TEXT NOT NULL, payload_json TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT);",
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 3,
                            description: "index_local_assets",
                            sql: "CREATE INDEX assets_updated_at_idx ON assets(updated_at);",
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 4,
                            description: "create_local_categories",
                            sql: "CREATE TABLE categories (id TEXT PRIMARY KEY NOT NULL, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL);",
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 5,
                            description: "create_local_locations",
                            sql: "CREATE TABLE locations (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, kind TEXT NOT NULL, parent_id TEXT, building TEXT, floor TEXT, capacity INTEGER, payload_json TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT);",
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 6,
                            description: "index_local_locations",
                            sql: "CREATE INDEX locations_parent_idx ON locations(parent_id);",
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 7,
                            description: "create_sync_outbox",
                            sql: "CREATE TABLE outbox (id TEXT PRIMARY KEY NOT NULL, mutation_id TEXT NOT NULL UNIQUE, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, operation TEXT NOT NULL, base_version INTEGER, payload_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT, created_at TEXT NOT NULL);",
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 8,
                            description: "index_sync_outbox",
                            sql: "CREATE INDEX outbox_status_idx ON outbox(status);",
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 9,
                            description: "create_local_app_state",
                            sql: "CREATE TABLE app_state (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);",
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 10,
                            description: "cache_local_role_id",
                            sql: "ALTER TABLE users ADD COLUMN role_id TEXT;",
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 11,
                            description: "cache_local_role_name",
                            sql: "ALTER TABLE users ADD COLUMN role_name TEXT;",
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 12,
                            description: "cache_local_role_menus",
                            sql: "ALTER TABLE users ADD COLUMN menu_keys_json TEXT NOT NULL DEFAULT '[]';",
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                    ],
                )
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("gagal menjalankan aplikasi Sisarpras");
}
