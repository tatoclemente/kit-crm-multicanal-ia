/**
 * Manda eventos de prueba firmados al webhook local, con datos ficticios.
 *
 * Dos cosas que hace a propósito:
 *  - Sella cada evento con la hora de AHORA, salvo los marcados `_viejo`. Si no, el
 *    archivo envejecería y el agente descartaría todo por vencido.
 *  - Repite el primer evento al final, con el mismo id: la segunda vez NO tiene que
 *    insertar nada.
 *
 *   npm run webhook:simular
 *   npm run webhook:simular -- http://localhost:3000
 */
import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const base = process.argv[2] ?? "http://localhost:3000";
const secreto = process.env.ZERNIO_WEBHOOK_SECRET;

if (!secreto) {
  console.error("✗ Falta ZERNIO_WEBHOOK_SECRET en el entorno (.env.local).");
  process.exit(1);
}

const archivo = join(process.cwd(), "..", "ejemplos", "tienda-y-servicio-tecnico", "eventos.json");

interface EventoDePrueba extends Record<string, unknown> {
  id: string;
  event: string;
  _nota?: string;
  /** true = se manda con fecha vieja a propósito, para probar el descarte por vencido. */
  _viejo?: boolean;
}

async function main(): Promise<void> {
  let eventos: EventoDePrueba[];
  try {
    eventos = JSON.parse(readFileSync(archivo, "utf8")) as EventoDePrueba[];
  } catch (e) {
    console.error(`✗ No pude leer ${archivo}: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }

  const destino = `${base}/api/webhooks/zernio`;
  // Sufijo por corrida: podés correr esto muchas veces sin que todo sea un reintento.
  const corrida = randomUUID().slice(0, 8);

  console.log(`Mandando ${eventos.length} eventos a ${destino}`);
  console.log(`Corrida: ${corrida}\n`);

  let primero: Record<string, unknown> | null = null;

  for (const crudo of eventos) {
    const evento = sellar(crudo, corrida);
    if (!primero) primero = evento;
    await mandar(destino, evento, crudo._nota);
  }

  if (primero) {
    console.log("\nRepitiendo el primer evento, con el mismo id:");
    await mandar(destino, primero, "prueba de idempotencia");
    console.log("\n→ Esa última respuesta tiene que decir  reintento:true");
    console.log("  y el conteo de filas en `messages` NO tiene que haber subido.");
    console.log("\n  select count(*) from messages;   -- correlo antes y después");
  }
}

/** Le pone id de corrida y fecha de ahora. Los marcados `_viejo` quedan con fecha vieja. */
function sellar(evento: EventoDePrueba, corrida: string): Record<string, unknown> {
  const copia = structuredClone(evento) as Record<string, unknown>;
  delete copia._nota;
  delete copia._viejo;

  copia.id = `${evento.id}-${corrida}`;

  const cuando = evento._viejo
    ? new Date(Date.now() - 2 * 60 * 60 * 1000) // dos horas atrás
    : new Date();
  copia.timestamp = cuando.toISOString();

  const mensaje = copia.message as Record<string, unknown> | undefined;
  if (mensaje) {
    mensaje.sentAt = cuando.toISOString();
    if (typeof mensaje.platformMessageId === "string") {
      mensaje.platformMessageId = `${mensaje.platformMessageId}-${corrida}`;
    }
  }

  return copia;
}

async function mandar(
  destino: string,
  evento: Record<string, unknown>,
  nota?: string,
): Promise<void> {
  const cuerpo = JSON.stringify(evento);
  const firma = createHmac("sha256", secreto!).update(cuerpo, "utf8").digest("hex");

  // Un evento marcado como "firma mal" se manda con una firma inválida a propósito.
  const firmaFinal = nota?.includes("firma inválida") ? "0".repeat(64) : firma;

  try {
    const res = await fetch(destino, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Zernio-Signature": firmaFinal },
      body: cuerpo,
    });
    const texto = await res.text();
    const marca = res.status === 401 && nota?.includes("firma inválida") ? "✓" : res.ok ? "✓" : "✗";
    console.log(`  ${marca} ${String(evento.event).padEnd(20)} ${res.status}  ${texto.slice(0, 90)}`);
    if (nota) console.log(`     ${nota}`);
  } catch (e) {
    console.log(`  ✗ ${String(evento.event)} → ${e instanceof Error ? e.message : String(e)}`);
  }
}

void main();
