/**
 * Registra el webhook POR API, no a mano en el panel: los proveedores no suelen validar
 * URLs duplicadas y terminás recibiendo cada evento dos o tres veces.
 *
 *   npm run webhook:registrar -- https://tu-crm.vercel.app
 */
import { registrarWebhook } from "../src/lib/canales/zernio/webhooks";

async function main(): Promise<void> {
  const base = process.argv[2];
  if (!base) {
    console.error("Falta la URL base. Ejemplo:\n  npm run webhook:registrar -- https://tu-crm.vercel.app");
    process.exit(1);
  }

  let url: URL;
  try {
    url = new URL(base);
  } catch {
    console.error(`✗ URL inválida: ${base}`);
    process.exit(1);
  }

  if (url.protocol !== "https:") {
    console.error("✗ El webhook tiene que ser https. Un endpoint en http se puede leer en el camino.");
    process.exit(1);
  }

  const secreto = process.env.ZERNIO_WEBHOOK_SECRET;
  if (!secreto || secreto.length < 16) {
    console.error("✗ Falta ZERNIO_WEBHOOK_SECRET (16 caracteres o más) en el entorno.");
    console.error("  Sin secreto, la ruta rechaza todo: el CRM no recibiría un solo mensaje.");
    process.exit(1);
  }

  const destino = `${url.origin}/api/webhooks/zernio`;
  const nombre = process.env.WEBHOOK_NOMBRE ?? `crm-multicanal-${url.hostname}`;

  console.log(`Registrando "${nombre}" → ${destino}`);
  const res = await registrarWebhook({ nombre, url: destino, secreto });

  if (!res.ok) {
    console.error(`✗ ${res.error}`);
    process.exit(1);
  }

  console.log(`✓ ${res.data.creado ? "Creado" : "Actualizado"} (id ${res.data.id})`);
  console.log("\nProbá que llega: mandá un mensaje real al número o cuenta conectada y");
  console.log("mirá la tabla webhook_events. Si no aparece la fila, no llegó — no alcanza");
  console.log("con que el panel diga 'activo'.");
}

void main();
