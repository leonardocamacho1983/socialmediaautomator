import "server-only";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

type GroqMessage = {
  role: "system" | "user";
  content: string;
};

export function isGroqConfigured() {
  return Boolean(process.env.GROQ_API_KEY);
}

export function getGroqConfigStatus() {
  return {
    hasApiKey: isGroqConfigured(),
    model: process.env.GROQ_MODEL || DEFAULT_MODEL,
  };
}

export async function generateJsonWithGroq<T>(input: {
  system: string;
  prompt: string;
  fallback: T;
}) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return {
      provider: "fallback" as const,
      model: null,
      data: input.fallback,
    };
  }

  const model = process.env.GROQ_MODEL || DEFAULT_MODEL;
  const messages: GroqMessage[] = [
    { role: "system", content: input.system },
    { role: "user", content: input.prompt },
  ];
  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.8,
      response_format: { type: "json_object" },
    }),
    cache: "no-store",
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      `Groq respondeu com HTTP ${response.status}: ${JSON.stringify(body)}`,
    );
  }

  const content = body?.choices?.[0]?.message?.content;

  if (typeof content !== "string") {
    throw new Error("Groq não retornou conteúdo JSON.");
  }

  try {
    return {
      provider: "groq" as const,
      model,
      data: JSON.parse(content) as T,
    };
  } catch {
    throw new Error("Groq retornou JSON inválido.");
  }
}
