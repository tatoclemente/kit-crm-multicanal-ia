/**
 * Siembra el caso ficticio del kit: una cuenta de cada canal, las etapas del pipeline y
 * la configuración del agente. Es lo que hace que `npm run webhook:simular` funcione de
 * punta a punta sin conectar ninguna cuenta real.
 *
 * Todos los datos son inventados. Ninguna persona, número ni cuenta de acá existe.
 *
 *   npm run sembrar:ejemplo
 */
import { db, esquema } from "../src/lib/db";

async function main(): Promise<void> {
  console.log("Sembrando el caso ficticio...\n");

  const cuentas = [
    { channel: "whatsapp" as const, externalId: "acct_wa_ficticia", username: "+54 9 11 0000-0000" },
    { channel: "instagram" as const, externalId: "acct_ig_ficticia", username: "@tienda.ficticia" },
    { channel: "facebook" as const, externalId: "acct_fb_ficticia", username: "Tienda Ficticia" },
  ];

  for (const c of cuentas) {
    await db
      .insert(esquema.channelAccounts)
      .values({ ...c, displayName: "Tienda Ficticia (ejemplo)" })
      .onConflictDoNothing();
    console.log(`  ✓ cuenta ${c.channel}: ${c.externalId}`);
  }

  const etapas = [
    { name: "Nuevo", position: 1, kind: "open" },
    { name: "Contactado", position: 2, kind: "open" },
    { name: "Presupuestado", position: 3, kind: "open" },
    { name: "Ganado", position: 4, kind: "won" },
    { name: "Perdido", position: 5, kind: "lost" },
  ];
  for (const e of etapas) await db.insert(esquema.pipelineStages).values(e).onConflictDoNothing();
  console.log(`  ✓ ${etapas.length} etapas del pipeline`);

  // El canal principal prendido; los otros dos APAGADOS, como corresponde.
  const configs = [
    {
      channel: "global",
      enabled: false,
      systemPrompt:
        "Atendés la tienda y el servicio técnico de Tienda Ficticia. Consultá siempre el sistema antes de decir un estado, un precio o una fecha. Si no lo podés confirmar, decilo.",
      enabledTools: ["calificar_contacto", "derivar_a_humano", "consultar_sistema"],
      allowedPrices: ["72000", "40500", "62000", "97000", "38000"],
      allowedHosts: ["tienda.ejemplo.test", "seguimiento.ejemplo.test"],
      fallbackMessage: "Dejame confirmar ese dato con el equipo y te respondo en un rato.",
    },
    { channel: "whatsapp", enabled: true },
    { channel: "instagram", enabled: false },
    { channel: "facebook", enabled: false },
  ];
  for (const c of configs) await db.insert(esquema.agentConfigs).values(c).onConflictDoNothing();
  console.log(`  ✓ configuración del agente (solo whatsapp prendido)`);

  console.log("\n✓ Listo. Ahora:  npm run dev   y en otra terminal:  npm run webhook:simular");
}

void main();
