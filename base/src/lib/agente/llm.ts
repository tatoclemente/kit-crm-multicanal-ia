import OpenAI from "openai";
import { entorno } from "@/lib/entorno";

/**
 * Una sola credencial, muchos modelos: OpenRouter. El kit no se casa con un proveedor
 * de IA, igual que no se casa con un proveedor de canales.
 *
 * No uses modelos ":free": se saturan y devuelven 429 en producción.
 */
export const openrouter = new OpenAI({
  apiKey: entorno.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

export type MensajeChat = OpenAI.Chat.Completions.ChatCompletionMessageParam;
export type HerramientaChat = OpenAI.Chat.Completions.ChatCompletionTool;

export interface RespuestaModelo {
  texto: string | null;
  llamadas: { id: string; nombre: string; argumentos: string }[];
  mensajeCrudo: OpenAI.Chat.Completions.ChatCompletionMessage | null;
}

export async function pedirRespuesta(opts: {
  modelo: string;
  mensajes: MensajeChat[];
  herramientas: HerramientaChat[];
}): Promise<{ ok: true; data: RespuestaModelo } | { ok: false; error: string }> {
  try {
    const res = await openrouter.chat.completions.create({
      model: opts.modelo,
      messages: opts.mensajes,
      tools: opts.herramientas.length > 0 ? opts.herramientas : undefined,
      temperature: 0.4,
      max_tokens: 700,
    });

    const eleccion = res.choices[0]?.message ?? null;

    return {
      ok: true,
      data: {
        texto: eleccion?.content ?? null,
        llamadas: (eleccion?.tool_calls ?? [])
          .filter((c) => c.type === "function")
          .map((c) => ({
            id: c.id,
            nombre: c.function.name,
            argumentos: c.function.arguments,
          })),
        mensajeCrudo: eleccion,
      },
    };
  } catch (e) {
    const motivo = e instanceof Error ? e.message : String(e);
    return { ok: false, error: motivo };
  }
}
