import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { extractReasoningMiddleware, wrapLanguageModel } from "ai";

/**
 * MiniMax por su endpoint compatible con OpenAI. M2.x escribe su razonamiento
 * inline entre <think>…</think>: el middleware lo separa para que no llegue al chat.
 */
export function modelo() {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw new Error("Falta MINIMAX_API_KEY.");
  const minimax = createOpenAICompatible({
    name: "minimax",
    apiKey,
    baseURL: process.env.MINIMAX_BASE_URL || "https://api.minimax.io/v1",
  });
  return wrapLanguageModel({
    model: minimax.chatModel(process.env.MINIMAX_MODEL || "MiniMax-M2.7"),
    middleware: extractReasoningMiddleware({ tagName: "think" }),
  });
}
