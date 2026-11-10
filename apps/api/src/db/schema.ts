import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/* -----------------------------------------------------------------------------
 * Enums — kept identical to the values in @sisarpras/domain so the same zod
 * schemas validate on both sides of the wire.
 * -------------------------------------------------------------------------- */

export const assetConditionEnum = pgEnum("asset_condition", ["good", "fair", "damaged"]);
export const assetStatusEnum = pgEnum("asset_status", ["available", "assigned", "maintenance", "disposed"]);
export const locationKindEnum = pgEnum("location_kind", ["building", "floor", "room", "storage"]);
export const userRoleEnum = pgEnum("user_role", ["admin", "operator", "viewer"]);
export const mutationOperationEnum = pgEnum("mutation_operation", ["create", "update", "delete"]);
export const attachmentEntityEnum = pgEnum("attachment_entity", ["asset", "procurement"]);

export const procurementStatusEnum = pgEnum("procurement_status", [
  "draft",
  "submitted",
  "approved",
  "rejected",
  "received",
]);

/* -----------------------------------------------------------------------------
 * Identity
 * -------------------------------------------------------------------------- */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    role: userRoleEnum("role").notNull().default("viewer"),
    roleId: uuid("role_id").notNull().references(() => roles.id),
    /** Argon2/bcrypt hash. Never a plaintext password. */
    passwordHash: text("password_hash").notNull(),
    /** Scrypt hash for PIN-only local accounts. */
    pinHash: text("pin_hash"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

/** Configurable named roles retain a capability profile used by API write rules. */
export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: varchar("key", { length: 80 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  description: varchar("description", { length: 255 }),
  accessLevel: userRoleEnum("access_level").notNull().default("viewer"),
  menuKeys: text("menu_keys").array().notNull().default([]),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("roles_key_unique").on(table.key)]);

/** Global menu switches; required entries cannot be disabled by the UI/API. */
export const appMenus = pgTable("app_menus", {
  key: varchar("key", { length: 80 }).primaryKey(),
  label: varchar("label", { length: 100 }).notNull(),
  enabled: boolean("enabled").notNull().default(true),
  required: boolean("required").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* -----------------------------------------------------------------------------
 * Reference data
 * -------------------------------------------------------------------------- */

export const assetCategories = pgTable(
  "asset_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 20 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("asset_categories_code_unique").on(table.code)],
);

/** Buildings > floors > rooms > storage, linked by parent_id. */
export const locations = pgTable(
  "locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    kind: locationKindEnum("kind").notNull(),
    parentId: uuid("parent_id"),
    building: varchar("building", { length: 255 }),
    floor: varchar("floor", { length: 100 }),
    capacity: integer("capacity"),
    active: boolean("active").notNull().default(true),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [index("locations_parent_idx").on(table.parentId), index("locations_kind_idx").on(table.kind)],
);

/* -----------------------------------------------------------------------------
 * Fixed assets
 * -------------------------------------------------------------------------- */

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assetCode: varchar("asset_code", { length: 100 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),

    categoryId: uuid("category_id").notNull().references(() => assetCategories.id),
    locationId: uuid("location_id").references(() => locations.id),
    stockQuantity: integer("stock_quantity").notNull().default(0),

    serialNumber: varchar("serial_number", { length: 150 }),
    description: text("description"),

    condition: assetConditionEnum("condition").notNull().default("good"),
    status: assetStatusEnum("status").notNull().default("available"),

    acquisitionDate: date("acquisition_date"),
    /** Integer rupiah — never a floating-point money type. */
    acquisitionCostIdr: bigint("acquisition_cost_idr", { mode: "number" }),

    /** Optimistic concurrency token, bumped on every accepted mutation. */
    version: integer("version").notNull().default(1),

    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    /** Soft delete only: disposal keeps the row and its history. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("assets_asset_code_unique").on(table.assetCode),
    index("assets_name_idx").on(table.name),
    index("assets_category_idx").on(table.categoryId),
    index("assets_location_idx").on(table.locationId),
    index("assets_status_idx").on(table.status),
    index("assets_updated_at_idx").on(table.updatedAt),
  ],
);

/** Number of units from an asset item currently used in each room. */
export const assetRoomStocks = pgTable(
  "asset_room_stocks",
  {
    assetId: uuid("asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
    locationId: uuid("location_id").notNull().references(() => locations.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("asset_room_stocks_asset_location_unique").on(table.assetId, table.locationId), index("asset_room_stocks_location_idx").on(table.locationId)],
);

/** Active and historical loans of unallocated asset stock. */
export const assetLoans = pgTable("asset_loans", {
  id: uuid("id").primaryKey().defaultRandom(),
  assetId: uuid("asset_id").notNull().references(() => assets.id),
  borrowerName: varchar("borrower_name", { length: 255 }).notNull(),
  quantity: integer("quantity").notNull(),
  startDate: date("start_date").notNull(),
  dueDate: date("due_date").notNull(),
  returnedAt: timestamp("returned_at", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("asset_loans_asset_active_idx").on(table.assetId, table.returnedAt), index("asset_loans_due_date_idx").on(table.dueDate)]);

/** Custody history. Phase 2 in the blueprint but the table is cheap to carry. */
export const assetAssignments = pgTable(
  "asset_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assetId: uuid("asset_id").notNull().references(() => assets.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
    returnedAt: timestamp("returned_at", { withTimezone: true }),
    note: text("note"),
  },
  (table) => [index("asset_assignments_asset_idx").on(table.assetId)],
);

/** Append-only audit trail: who changed what, with before/after values. */
export const assetEvents = pgTable(
  "asset_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assetId: uuid("asset_id").notNull().references(() => assets.id),
    actorId: uuid("actor_id").references(() => users.id),
    operation: mutationOperationEnum("operation").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    mutationId: varchar("mutation_id", { length: 100 }),
    deviceId: varchar("device_id", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("asset_events_asset_idx").on(table.assetId), index("asset_events_created_idx").on(table.createdAt)],
);

/* -----------------------------------------------------------------------------
 * Consumable stock — quantities move only through append-only transactions
 * -------------------------------------------------------------------------- */

export const stockItems = pgTable("stock_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  unit: varchar("unit", { length: 50 }).notNull(),
  quantity: integer("quantity").notNull().default(0),
  reorderLevel: integer("reorder_level").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stockItemId: uuid("stock_item_id").notNull().references(() => stockItems.id),
    /** Positive = stock in, negative = stock out. */
    delta: integer("delta").notNull(),
    reason: varchar("reason", { length: 255 }),
    actorId: uuid("actor_id").references(() => users.id),
    transactionId: varchar("transaction_id", { length: 100 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("stock_movements_transaction_unique").on(table.transactionId),
    index("stock_movements_item_idx").on(table.stockItemId),
  ],
);

/* -----------------------------------------------------------------------------
 * Procurement (pengadaan)
 * -------------------------------------------------------------------------- */

export const procurementRequests = pgTable(
  "procurement_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: varchar("reference", { length: 50 }).notNull(),
    itemName: varchar("item_name", { length: 255 }).notNull(),
    quantity: integer("quantity").notNull().default(1),
    vendor: varchar("vendor", { length: 255 }),
    proposedPriceIdr: bigint("proposed_price_idr", { mode: "number" }).notNull(),
    approvedPriceIdr: bigint("approved_price_idr", { mode: "number" }),
    requestedAt: date("requested_at").notNull(),
    status: procurementStatusEnum("status").notNull().default("submitted"),
    notes: text("notes"),
    requestedBy: uuid("requested_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("procurement_requests_reference_unique").on(table.reference),
    index("procurement_requests_status_idx").on(table.status),
    index("procurement_requests_created_idx").on(table.createdAt),
  ],
);

/* -----------------------------------------------------------------------------
 * Attachments — metadata only. The bytes stay on the device that uploaded
 * them (IndexedDB / desktop SQLite), never on a public URL.
 * -------------------------------------------------------------------------- */

export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: attachmentEntityEnum("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    /** Key in object storage; the bytes never live in Postgres. */
    storageKey: text("storage_key").notNull(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("attachments_entity_idx").on(table.entityType, table.entityId)],
);

/* -----------------------------------------------------------------------------
 * Synchronisation
 * -------------------------------------------------------------------------- */

/** One row per registered desktop installation. */
export const devices = pgTable(
  "devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    platform: varchar("platform", { length: 50 }).notNull().default("windows"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("devices_name_unique").on(table.name)],
);

/**
 * Server-side change feed. `seq` is the monotonic cursor clients pull with —
 * never a device clock, so ordering is total and gap-free.
 */
export const syncChanges = pgTable(
  "sync_changes",
  {
    seq: bigint("seq", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    operation: mutationOperationEnum("operation").notNull(),
    version: integer("version").notNull(),
    payload: jsonb("payload").notNull(),
    deviceId: uuid("device_id").references(() => devices.id),
    actorId: uuid("actor_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("sync_changes_entity_idx").on(table.entityType, table.entityId)],
);

/** Idempotency guard: a repeated mutation_id must never apply twice. */
export const processedMutations = pgTable(
  "processed_mutations",
  {
    mutationId: varchar("mutation_id", { length: 100 }).primaryKey(),
    deviceId: uuid("device_id").references(() => devices.id),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    result: jsonb("result").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("processed_mutations_processed_idx").on(table.processedAt)],
);
