/**
 * Prueba contra la API REAL que las credenciales y los tipos están bien, antes de
 * construir nada encima. Un webhook que responde 200 no prueba nada: lo que prueba es
 * que la API te devuelve lo que esperás.
 *
 *   npm run verificar:proveedor
 */
import { listarCuentas } from "../src/lib/canales/zernio/cuentas";
import { listarConversaciones } from "../src/lib/canales/zernio/bandeja";
import { listarWebhooks } from "../src/lib/canales/zernio/webhooks";

async function main(): Promise<void> {
  console.log("1 · Cuentas conectadas\n");
  const cuentas = await listarCuentas();
  if (!cuentas.ok) {
    console.error(`✗ ${cuentas.error}`);
    console.error("\n  Revisá ZERNIO_API_KEY. Debe ser una clave restringida (zrk_) con los");
    console.error("  grupos messages, accounts y webhooks.");
    process.exit(1);
  }

  if (cuentas.data.length === 0) {
    console.warn("⚠ La clave funciona, pero no hay ninguna cuenta conectada todavía.");
    console.warn("  Conectá WhatsApp, Instagram o Messenger desde el panel del proveedor.");
  }
  for (const c of cuentas.data) {
    console.log(`  ✓ ${c.channel.padEnd(10)} ${c.username ?? "(sin usuario)"}  id=${c.externalId}`);
  }

  console.log("\n2 · Conversaciones (primeras 3)\n");
  let vistas = 0;
  for await (const conv of listarConversaciones({ limite: 10 })) {
    console.log(
      `  ✓ ${conv.channel.padEnd(10)} ${(conv.participantName ?? "sin nombre").padEnd(24)} id=${conv.externalId}`,
    );
    if (++vistas >= 3) break;
  }
  if (vistas === 0) console.log("  (todavía no hay conversaciones en esas cuentas)");

  console.log("\n3 · Webhooks registrados\n");
  const webhooks = await listarWebhooks();
  if (!webhooks.ok) {
    console.error(`  ✗ ${webhooks.error}`);
  } else if (webhooks.data.length === 0) {
    console.log("  (ninguno todavía — se registra con npm run webhook:registrar)");
  } else {
    for (const w of webhooks.data) {
      const estado = w.isActive ? "activo" : "APAGADO";
      const fallos = w.failureCount ?? 0;
      console.log(`  ${fallos >= 5 ? "⚠" : "✓"} ${w.name} → ${w.url} [${estado}, ${fallos} fallos]`);
      if (fallos >= 5) {
        console.log("     A los 10 fallos seguidos el proveedor lo apaga y el CRM se queda mudo.");
      }
    }
  }

  console.log("\n✓ Verificación terminada contra la API real.");
}

void main();
