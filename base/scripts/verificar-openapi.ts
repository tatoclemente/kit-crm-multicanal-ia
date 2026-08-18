/**
 * Baja el OpenAPI real del proveedor y comprueba que los nombres que el kit tiene
 * tipados sigan existiendo.
 *
 * Esta es la regla número uno: un nombre de campo mal adivinado no rompe el build,
 * descarta cada mensaje que entra. Corré esto ANTES de tocar el cliente HTTP y cada vez
 * que algo deje de funcionar sin explicación.
 *
 *   npm run verificar:openapi
 */
const URL_SPEC = process.env.ZERNIO_OPENAPI_URL ?? "https://docs.zernio.com/api/openapi";

/** Lo que `src/lib/canales/zernio/` da por cierto. Si algo de acá desaparece, hay que arreglar los tipos. */
const RUTAS = [
  "/v1/inbox/conversations",
  "/v1/inbox/conversations/{conversationId}/messages",
  "/v1/inbox/conversations/{conversationId}/read",
  "/v1/accounts",
  "/v1/webhooks/settings",
];

const CAMPOS_WEBHOOK = [
  "platformMessageId",
  "platformConversationId",
  "phoneNumber",
  "participantName",
  "refreshUrl",
];

const CAMPOS_REST = ["participantId", "unreadCount", "updatedTime", "senderId", "attachments"];

const OTROS = ["X-Zernio-Signature", "message.received", "account.connected"];

async function main(): Promise<void> {
  console.log(`Bajando ${URL_SPEC} ...`);
  const res = await fetch(URL_SPEC, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) {
    console.error(`✗ No se pudo bajar el spec: HTTP ${res.status}`);
    process.exit(1);
  }

  const spec = await res.text();
  console.log(`✓ Bajado: ${(spec.length / 1024 / 1024).toFixed(1)} MB\n`);

  const version = spec.match(/version:\s*["']?([\d.]+)["']?/)?.[1] ?? "desconocida";
  console.log(`Versión declarada: ${version}`);
  console.log(`Versión con la que se escribió el cliente: 1.0.4 (17/08/2026)\n`);

  let faltan = 0;

  for (const [titulo, lista] of [
    ["Rutas", RUTAS],
    ["Campos del webhook", CAMPOS_WEBHOOK],
    ["Campos del REST", CAMPOS_REST],
    ["Otros", OTROS],
  ] as const) {
    console.log(`${titulo}:`);
    for (const item of lista) {
      const existe = spec.includes(item);
      console.log(`  ${existe ? "✓" : "✗"} ${item}`);
      if (!existe) faltan++;
    }
    console.log("");
  }

  if (faltan > 0) {
    console.error(
      `✗ ${faltan} nombre(s) ya no aparecen en el spec.\n` +
        `  NO sigas construyendo: revisá src/lib/canales/zernio/tipos.ts y mapeo.ts,\n` +
        `  y actualizá .agents/skills/crm-multicanal/referencias/zernio-verificado.md.`,
    );
    process.exit(1);
  }

  console.log("✓ Todos los nombres que usa el kit siguen existiendo en el spec de hoy.");
  console.log(
    "\nOjo: esto comprueba que el nombre EXISTE, no que siga significando lo mismo.\n" +
      "Ante una duda real, leé el spec y verificá contra la API con verificar:proveedor.",
  );
}

void main();
