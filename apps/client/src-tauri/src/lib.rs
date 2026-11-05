#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
                    ],
                )
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("gagal menjalankan aplikasi Sisarpras");
}
