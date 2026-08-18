/**
 * Un mensaje de WhatsApp no es un informe. Sacamos las marcas que delatan un bot y
 * partimos la respuesta como escribiría una persona.
 */
export function humanizar(texto: string): string[] {
  let limpio = texto
    .replace(/\*\*(.+?)\*\*/g, "$1") // negrita de markdown
    .replace(/^#{1,6}\s+/gm, "") // títulos
    .replace(/^[-*]\s+/gm, "• ") // viñetas
    .replace(/—/g, ", ") // raya larga
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // El modelo puede marcar un corte explícito con |||
  if (limpio.includes("|||")) {
    return limpio
      .split("|||")
      .map((p) => p.trim())
      .filter(Boolean)
      .slice(0, 4);
  }

  // Si es corto, va de una.
  if (limpio.length <= 320) return [limpio];

  // Si no, cortamos por párrafo, sin partir a la mitad de una idea.
  const partes: string[] = [];
  let actual = "";
  for (const parrafo of limpio.split(/\n{2,}/)) {
    if ((actual + parrafo).length > 320 && actual) {
      partes.push(actual.trim());
      actual = parrafo;
    } else {
      actual = actual ? `${actual}\n\n${parrafo}` : parrafo;
    }
  }
  if (actual.trim()) partes.push(actual.trim());

  return partes.slice(0, 4);
}
