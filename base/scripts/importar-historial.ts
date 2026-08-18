/**
 * Importa las conversaciones que el proveedor ya tenía replicadas al conectar la cuenta.
 * No llegan por webhook: si no las importás, la bandeja arranca vacía.
 *
 * EL AGENTE NO SE DISPARA EN LA IMPORTACIÓN. Contestarle de golpe a cientos de clientes
 * viejos es un desastre difícil de explicar e imposible de deshacer. Este script solo
 * escribe en la base; nunca llama al agente ni envía nada.
 *
 *   npm run importar:historial -- --confirmar
 */
import { listarConversaciones, listarMensajes } from "../src/lib/canales/zernio/bandeja";
import { registrarEntrante } from "../src/lib/mensajeria/ingreso";

async function main(): Promise<void> {
  if (!process.argv.includes("--confirmar")) {
    console.log("Esto importa el historial de TODAS las cuentas conectadas a la base.");
    console.log("No envía mensajes y no dispara al agente, pero escribe muchas filas.");
    console.log("\nSi estás de acuerdo:  npm run importar:historial -- --confirmar");
    process.exit(0);
  }

  let hilos = 0;
  let mensajes = 0;
  let ignorados = 0;

  for await (const conv of listarConversaciones({ limite: 50 })) {
    const res = await listarMensajes(conv.externalId, conv.accountExternalId, { limite: 50 });
    if (!res.ok) {
      console.warn(`  ⚠ ${conv.externalId}: ${res.error}`);
      continue;
    }

    hilos++;
    for (const mensaje of res.data) {
      const guardado = await registrarEntrante({
        mensaje,
        conversacion: {
          externalId: conv.externalId,
          participantId: conv.participantId,
          participantName: conv.participantName,
          participantHandle: conv.participantHandle,
          participantPicture: conv.participantPicture,
          metadata: conv.metadata,
        },
        cuentaExternalId: conv.accountExternalId,
      });

      if (guardado === null) ignorados++;
      else if (guardado.esNuevo) mensajes++;
    }

    if (hilos % 20 === 0) console.log(`  ... ${hilos} hilos, ${mensajes} mensajes`);
  }

  console.log(`\n✓ ${hilos} conversaciones, ${mensajes} mensajes nuevos.`);
  if (ignorados > 0) {
    console.log(`  ${ignorados} mensajes ignorados: su cuenta no está registrada en channel_accounts.`);
    console.log("  Corré primero la sincronización de cuentas.");
  }
  console.log("\nEl agente NO se ejecutó sobre nada de esto, que es lo correcto.");
}

void main();
