const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface OpenRouterMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  max_tokens?: number;
  temperature?: number;
}

export interface OpenRouterResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export async function generateText(
  apiKey: string,
  prompt: string,
  model: string = "openai/gpt-3.5-turbo",
  systemPrompt?: string
): Promise<string> {
  const messages: OpenRouterMessage[] = [];
  
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  
  messages.push({ role: "user", content: prompt });

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://github.com/faustofang/esp32-revTFT-examples", // Optional
      "X-Title": "Fausto BLE Badge", // Optional
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 200,
      temperature: 0.7,
    } as OpenRouterRequest),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenRouter API error: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const data: OpenRouterResponse = await response.json();

  if (!data.choices || data.choices.length === 0) {
    throw new Error("No response from OpenRouter API");
  }

  return data.choices[0].message.content.trim();
}

export const POPULAR_MODELS = [
  { id: "openai/gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
  { id: "openai/gpt-4", name: "GPT-4" },
  { id: "openai/gpt-4-turbo", name: "GPT-4 Turbo" },
  { id: "anthropic/claude-3-haiku", name: "Claude 3 Haiku" },
  { id: "anthropic/claude-3-sonnet", name: "Claude 3 Sonnet" },
  { id: "google/gemini-pro", name: "Gemini Pro" },
  { id: "meta-llama/llama-3-8b-instruct", name: "Llama 3 8B" },
  { id: "meta-llama/llama-3-70b-instruct", name: "Llama 3 70B" },
];

