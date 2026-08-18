/**
 * Modelo de datos del CRM multicanal.
 *
 * Convención: los nombres de tablas y columnas van en inglés (es lo que espera
 * cualquier herramienta de SQL, BI o exportación que se enchufe después) y toda la
 * documentación, la interfaz y los prompts van en español. Es una decisión, no un
 * descuido: está anotada acá para que nadie la "arregle".
 *
 * Las tres decisiones que definen todo lo demás:
 *
 * 1. CANAL y PROVEEDOR son dos ejes distintos, no uno.
 *    channel  = la red que ve la persona (whatsapp | instagram | facebook)
 *    provider = por dónde viaja el mensaje (zernio | meta | ...)
 *    Van en columnas separadas porque van a convivir combinaciones distintas.
 *
 * 2. La unidad NO es el contacto: es la CONVERSACIÓN.
 *    La misma persona puede tener un hilo de WhatsApp y otro de Instagram, y no se
 *    mezclan. Rutas e historial del agente van por conversationId, nunca por contactId.
 *
 * 3. La identidad NO es el teléfono.
 *    Instagram y Messenger no tienen número. El contacto se resuelve por
 *    contact_identities (channel, external_id). En WhatsApp el teléfono puede venir
 *    nulo: el ancla es el id que da el proveedor.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/** Canales soportados. `facebook` es Messenger: el proveedor no usa el valor "messenger". */
export const CANALES = ["whatsapp", "instagram", "facebook"] as const;
export type Canal = (typeof CANALES)[number];

// ---------------------------------------------------------------------------
// Cuentas conectadas del proveedor
// ---------------------------------------------------------------------------

/**
 * Las cuentas conectadas. El id externo va único: es la clave con la que se rutea
 * todo lo que entra. Un webhook cuya cuenta no está acá se ignora con 200.
 */
export const channelAccounts = pgTable(
  "channel_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull().default("zernio"),
    channel: text("channel").$type<Canal>().notNull(),
    externalId: text("external_id").notNull(),
    username: text("username"),
    displayName: text("display_name"),
    profileId: text("profile_id"),
    connected: boolean("connected").notNull().default(true),
    connectedAt: timestamp("connected_at", { withTimezone: true }).defaultNow(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  },
  (t) => ({
    externalKey: uniqueIndex("channel_accounts_external_id_key").on(t.externalId),
  }),
);

// ---------------------------------------------------------------------------
// Contactos e identidades
// ---------------------------------------------------------------------------

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name"),
    phone: text("phone"),
    email: text("email"),
    /** Datos que captura el agente (zona, presupuesto, qué busca). Los define el negocio. */
    fields: jsonb("fields").$type<Record<string, unknown>>().notNull().default({}),
    /** Referencia al cliente en el sistema propio del negocio, si lo hay. */
    externalSystemId: text("external_system_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    phoneIdx: index("contacts_phone_idx").on(t.phone),
    externalIdx: index("contacts_external_system_idx").on(t.externalSystemId),
  }),
);

/**
 * Lo que hace que la misma persona escribiendo por dos redes caiga en un solo contacto.
 * Único por (channel, external_id): el mismo id puede repetirse entre canales distintos.
 */
export const contactIdentities = pgTable(
  "contact_identities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    channel: text("channel").$type<Canal>().notNull(),
    externalId: text("external_id").notNull(),
    handle: text("handle"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    identityKey: uniqueIndex("contact_identities_channel_external_key").on(
      t.channel,
      t.externalId,
    ),
    contactIdx: index("contact_identities_contact_idx").on(t.contactId),
  }),
);

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export const pipelineStages = pgTable("pipeline_stages", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  position: integer("position").notNull(),
  /** open | won | lost — define si la conversación sigue viva en el tablero. */
  kind: text("kind").notNull().default("open"),
  color: text("color"),
});

// ---------------------------------------------------------------------------
// Conversaciones
// ---------------------------------------------------------------------------

/**
 * El hilo real. Único por (provider, external_id): el mismo hilo no se duplica aunque
 * el proveedor reenvíe el evento de apertura.
 */
export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channel: text("channel").$type<Canal>().notNull(),
    provider: text("provider").notNull().default("zernio"),
    /** Id de la conversación en el proveedor. Opaco: se devuelve tal cual, no se parsea. */
    externalId: text("external_id").notNull(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => channelAccounts.id, { onDelete: "restrict" }),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),

    participantId: text("participant_id").notNull(),
    participantName: text("participant_name"),
    participantHandle: text("participant_handle"),
    participantPicture: text("participant_picture"),

    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    /**
     * Última vez que escribió la persona. De acá sale la ventana de 24 horas, y la
     * calcula el SERVIDOR. Si la calcula la interfaz, tarde o temprano manda algo
     * que rebota y el vendedor cree que contestó.
     */
    lastInboundAt: timestamp("last_inbound_at", { withTimezone: true }),
    unreadCount: integer("unread_count").notNull().default(0),

    /** Interruptor por conversación: sirve para que una persona tome el hilo a mano. */
    aiEnabled: boolean("ai_enabled").notNull().default(true),
    stageId: uuid("stage_id").references(() => pipelineStages.id, { onDelete: "set null" }),
    dealValue: numeric("deal_value", { precision: 14, scale: 2 }),
    assignedTo: uuid("assigned_to"),
    status: text("status").notNull().default("active"),

    /**
     * Atribución del anuncio, si el proveedor la manda. De qué campaña vino el lead es
     * información que después no se puede recuperar: se guarda apenas entra.
     */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    providerKey: uniqueIndex("conversations_provider_external_key").on(
      t.provider,
      t.externalId,
    ),
    lastMessageIdx: index("conversations_last_message_idx").on(t.lastMessageAt),
    contactIdx: index("conversations_contact_idx").on(t.contactId),
    stageIdx: index("conversations_stage_idx").on(t.stageId),
  }),
);

// ---------------------------------------------------------------------------
// Mensajes
// ---------------------------------------------------------------------------

/**
 * El índice único de idempotencia va sobre external_id SOLO, no sobre
 * (provider, external_id): si algún día se migra de proveedor, el mismo id entra por
 * dos webhooks distintos y con clave compuesta se duplica.
 *
 * Y va PARCIAL, donde external_id no es null: los mensajes que salen del CRM todavía
 * no tienen id del proveedor y chocarían entre sí.
 */
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    channel: text("channel").$type<Canal>().notNull(),
    provider: text("provider").notNull().default("zernio"),
    externalId: text("external_id"),
    /** inbound | outbound */
    direction: text("direction").notNull(),
    /** text | image | video | audio | file | sticker | share | template | system */
    type: text("type").notNull().default("text"),
    body: text("body"),
    /** Quién lo mandó del lado del CRM: agent | human | contact | system */
    author: text("author").notNull().default("contact"),
    authorUserId: uuid("author_user_id"),
    /** pending | sent | delivered | read | failed */
    status: text("status").notNull().default("sent"),
    error: text("error"),
    /**
     * En Instagram y Facebook la url de un adjunto es un enlace firmado de Meta que
     * VENCE. Persistimos refreshUrl, no url.
     */
    attachments: jsonb("attachments").$type<
      { type: string; refreshUrl?: string | null; url?: string; filename?: string | null }[]
    >(),
    rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    externalKey: uniqueIndex("messages_external_id_key")
      .on(t.externalId)
      .where(sql`external_id is not null`),
    conversationIdx: index("messages_conversation_idx").on(t.conversationId, t.sentAt),
  }),
);

// ---------------------------------------------------------------------------
// Idempotencia de webhooks
// ---------------------------------------------------------------------------

/**
 * La entrega es at-least-once. Cada evento se reclama por su id acá con
 * INSERT ... ON CONFLICT DO NOTHING RETURNING antes de procesarlo.
 * Si no insertó, es un reintento: 200 y se corta.
 *
 * processedAt queda null hasta que el trabajo en segundo plano termina. Los eventos
 * reclamados y sin procesar son los que levanta el barrido de recuperación.
 */
export const webhookEvents = pgTable(
  "webhook_events",
  {
    eventId: text("event_id").primaryKey(),
    provider: text("provider").notNull().default("zernio"),
    event: text("event").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    error: text("error"),
  },
  (t) => ({
    pendingIdx: index("webhook_events_pending_idx").on(t.processedAt, t.receivedAt),
  }),
);

// ---------------------------------------------------------------------------
// Configuración del agente
// ---------------------------------------------------------------------------

/**
 * Una fila por canal, más una fila global (channel = 'global') que actúa de cascada.
 * Los canales nuevos arrancan APAGADOS: si no, contestan con el prompt de otro canal
 * y se nota.
 */
export const agentConfigs = pgTable(
  "agent_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channel: text("channel").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    systemPrompt: text("system_prompt"),
    enabledTools: jsonb("enabled_tools").$type<string[]>().notNull().default([]),
    model: text("model"),
    /** Segundos que espera por si la persona sigue escribiendo, para responder a todo junto. */
    bufferSeconds: integer("buffer_seconds").notNull().default(8),
    /** Lista blanca de precios y de dominios enlazables. Ver guardrails. */
    allowedPrices: jsonb("allowed_prices").$type<string[]>().notNull().default([]),
    allowedHosts: jsonb("allowed_hosts").$type<string[]>().notNull().default([]),
    fallbackMessage: text("fallback_message"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    channelKey: uniqueIndex("agent_configs_channel_key").on(t.channel),
  }),
);

/** Cada vez que un guardrail bloquea una respuesta queda registrado acá y se puede auditar. */
export const guardrailEvents = pgTable("guardrail_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").references(() => conversations.id, {
    onDelete: "cascade",
  }),
  rule: text("rule").notNull(),
  detail: text("detail"),
  blockedText: text("blocked_text"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Tareas, notas y etiquetas
// ---------------------------------------------------------------------------

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    detail: text("detail"),
    conversationId: uuid("conversation_id").references(() => conversations.id, {
      onDelete: "cascade",
    }),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    doneAt: timestamp("done_at", { withTimezone: true }),
    assignedTo: uuid("assigned_to"),
    createdBy: text("created_by").notNull().default("human"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ dueIdx: index("tasks_due_idx").on(t.doneAt, t.dueAt) }),
);

export const notes = pgTable("notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  contactId: uuid("contact_id")
    .notNull()
    .references(() => contacts.id, { onDelete: "cascade" }),
  conversationId: uuid("conversation_id").references(() => conversations.id, {
    onDelete: "set null",
  }),
  body: text("body").notNull(),
  authorUserId: uuid("author_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  color: text("color"),
});

export const contactTags = pgTable(
  "contact_tags",
  {
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.contactId, t.tagId] }) }),
);

/** Historial de cambios de etapa. Sin esto no se puede explicar por qué se perdió un lead. */
export const stageHistory = pgTable("stage_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  fromStageId: uuid("from_stage_id"),
  toStageId: uuid("to_stage_id"),
  changedBy: text("changed_by").notNull().default("human"),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Integraciones
// ---------------------------------------------------------------------------

/** Webhooks que el CRM emite hacia afuera. El secreto firma el body igual que hace el proveedor. */
export const outboundWebhooks = pgTable("outbound_webhooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  secret: text("secret").notNull(),
  events: jsonb("events").$type<string[]>().notNull().default([]),
  active: boolean("active").notNull().default(true),
  failureCount: integer("failure_count").notNull().default(0),
  lastFiredAt: timestamp("last_fired_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const outboundDeliveries = pgTable(
  "outbound_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    webhookId: uuid("webhook_id")
      .notNull()
      .references(() => outboundWebhooks.id, { onDelete: "cascade" }),
    event: text("event").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    statusCode: integer("status_code"),
    error: text("error"),
    attempt: integer("attempt").notNull().default(1),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ webhookIdx: index("outbound_deliveries_webhook_idx").on(t.webhookId, t.createdAt) }),
);

/**
 * Claves de la API propia del CRM. Se guarda solo el hash: si alguien lee la base, no
 * se lleva claves usables. El prefijo sirve para mostrarla en la interfaz sin revelarla.
 */
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    prefix: text("prefix").notNull(),
    hash: text("hash").notNull(),
    /** Permisos por recurso: conversations:read, messages:write, contacts:write, ... */
    scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ prefixKey: uniqueIndex("api_keys_prefix_key").on(t.prefix) }),
);

/** Toda llamada al sistema externo queda registrada: es lo primero que se mira cuando falla. */
export const integrationCalls = pgTable("integration_calls", {
  id: uuid("id").primaryKey().defaultRandom(),
  system: text("system").notNull(),
  operation: text("operation").notNull(),
  conversationId: uuid("conversation_id"),
  ok: boolean("ok").notNull(),
  durationMs: integer("duration_ms"),
  detail: text("detail"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Usuarios del CRM
// ---------------------------------------------------------------------------

/** Espejo de auth.users de Supabase. El login lo maneja Supabase Auth, los roles acá. */
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  fullName: text("full_name"),
  /** owner | agent — owner configura, agent atiende. */
  role: text("role").notNull().default("agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
