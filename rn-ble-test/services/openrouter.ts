const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface OpenRouterMessage {
  role: "user" | "assistant" | "system";
  content: string;
  images?: { url: string }[]; // Adjust based on actual response if needed, but user snippet suggests message.images
}

export interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  max_tokens?: number;
  temperature?: number;
  modalities?: string[];
}

export interface OpenRouterResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
      images?: Array<{ imageUrl: { url: string } }>; // Matching user snippet
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
      "HTTP-Referer": "https://github.com/faustofang/esp32-revTFT-examples",
      "X-Title": "Fausto BLE Badge",
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

export async function generateImage(
  apiKey: string,
  prompt: string,
  model: string = "google/gemini-2.5-flash-image-preview" // Default to an image model
): Promise<string> {
  const messages: OpenRouterMessage[] = [
    {
      role: "user",
      content: prompt,
    },
  ];

  const body = {
    model,
    messages,
    modalities: ["image", "text"], // Explicitly request image
  };

  console.log("Requesting image from OpenRouter:", JSON.stringify(body));

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://github.com/faustofang/esp32-revTFT-examples",
      "X-Title": "Fausto BLE Badge",
    },
    body: JSON.stringify(body),
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

  const message = data.choices[0].message;

  // Check for images in the response structure
  if (message.images && message.images.length > 0) {
    return message.images[0].imageUrl.url;
  }

  // Fallback: sometimes logic might differ or it's in content as a link
  // But for this implementation, we expect the structured format.
  throw new Error("No image found in response");
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

export const POPULAR_IMAGE_MODELS = [
  { id: "openai/dall-e-3", name: "DALL-E 3" },
  { id: "openai/dall-e-2", name: "DALL-E 2" },
  // Add others as discovered/supported
];
