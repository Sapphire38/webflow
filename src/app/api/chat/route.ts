import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  hasToolCall,
  isStepCount,
  streamText,
  toUIMessageStream,
  type UIMessage,
  validateUIMessages,
} from "ai";
import { z } from "zod";
import { modelo } from "@/lib/server/llm";
import { systemPrompt } from "@/lib/server/prompt";
import { herramientas } from "@/lib/server/tools";
import { conIds, tituloDesde } from "@/lib/chat/titulo";
import { createClient } from "@/lib/supabase/server";


const bodySchema = z.object({
  id: z.string().min(1).max(64),
  message: z.custom<UIMessage>((m) => typeof m === "object" && m !== null && "parts" in m),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 });

  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Pedido inválido" }, { status: 400 });
  const { id, message } = body.data;
  if (message.role !== "user") return Response.json({ error: "Pedido inválido" }, { status: 400 });

  // La historia vive en el servidor: el cliente manda solo el mensaje nuevo.
  const { data: previa } = await supabase.from("conversaciones").select("mensajes").eq("id", id).maybeSingle();
  const tools = herramientas(supabase);
  const mensajes = await validateUIMessages({
    messages: [...conIds((previa?.mensajes as UIMessage[]) ?? []), message],
    tools,
  });

  const result = streamText({
    model: modelo(),
    system: systemPrompt((user.user_metadata?.full_name as string) ?? ""),
    messages: await convertToModelMessages(mensajes),
    tools,
    // Las sugerencias son el cierre del turno: cortamos ahí para que no agregue relleno después.
    stopWhen: [isStepCount(8), hasToolCall("sugerir_preguntas")],
    abortSignal: req.signal,
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      tools,
      originalMessages: mensajes,
      // Sin esto el SDK persiste los mensajes del asistente con id vacío.
      generateMessageId: () => crypto.randomUUID(),
      sendReasoning: false,
      onError: (e) => {
        console.error("chat", e);
        const msg = e instanceof Error ? e.message : "";
        if (/401|403|api key/i.test(msg)) return "El modelo rechazó la credencial. Revisá MINIMAX_API_KEY.";
        if (/429|rate/i.test(msg)) return "El modelo está saturado. Probá de nuevo en unos segundos.";
        return "No pude terminar la respuesta. Probá de nuevo.";
      },
      onEnd: async ({ messages }) => {
        const { error } = await supabase.from("conversaciones").upsert({
          id,
          user_id: user.id,
          titulo: tituloDesde(messages),
          mensajes: messages,
          updated_at: new Date().toISOString(),
        });
        if (error) console.error("guardar conversación", error.message);
      },
    }),
  });
}
