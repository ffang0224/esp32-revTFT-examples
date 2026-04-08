const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_TITLE = "Fausto BLE Badge";
const OPENROUTER_REFERER = "https://github.com/faustofang/esp32-revTFT-examples";

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
  image_config?: {
    aspect_ratio?: string;
    image_size?: string;
  };
}

export interface OpenRouterResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
      images?: Array<{ 
        imageUrl?: { url: string } | string;
        url?: string;
        [key: string]: any; // Allow other properties
      }>;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenRouterErrorBody {
  error?: {
    message?: string;
    code?: number | string;
    type?: string;
  };
  message?: string;
  [key: string]: any;
}

function shouldFallbackModel(error: unknown): boolean {
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    msg.includes(" 403 ") ||
    msg.includes(" 404 ") ||
    msg.includes("model not found") ||
    msg.includes("not enabled") ||
    msg.includes("unsupported model")
  );
}

function normalizeApiKey(apiKey: string): string {
  return (apiKey || "").trim().replace(/^["']|["']$/g, "");
}

async function buildOpenRouterError(response: Response): Promise<Error> {
  const status = response.status;
  const statusText = response.statusText || "Unknown";
  const requestId =
    response.headers.get("x-request-id") ||
    response.headers.get("x-openrouter-request-id") ||
    "";

  let parsedBody: OpenRouterErrorBody | null = null;
  let rawText = "";

  try {
    parsedBody = (await response.clone().json()) as OpenRouterErrorBody;
  } catch {
    try {
      rawText = await response.text();
    } catch {
      rawText = "";
    }
  }

  const apiMessage =
    parsedBody?.error?.message ||
    parsedBody?.message ||
    rawText ||
    "No additional error body";

  let hint = "";
  if (status === 401) {
    hint = "Check your OpenRouter API key in Settings (invalid, expired, or malformed key).";
  } else if (status === 402) {
    hint = "Your OpenRouter account likely has no credits or billing is required.";
  } else if (status === 403) {
    hint = "The requested model may not be enabled for your account.";
  } else if (status === 404) {
    hint = "Model not found or endpoint mismatch. Try a different model.";
  } else if (status === 429) {
    hint = "Rate limited. Wait a bit and retry.";
  } else if (status >= 500) {
    hint = "OpenRouter server-side issue. Retry shortly.";
  }

  const requestIdText = requestId ? ` (request_id=${requestId})` : "";
  const hintText = hint ? ` Hint: ${hint}` : "";
  return new Error(
    `OpenRouter API error: ${status} ${statusText}${requestIdText} - ${apiMessage}${hintText}`
  );
}

async function postOpenRouter(
  apiKey: string,
  body: OpenRouterRequest & { stream?: boolean }
): Promise<OpenRouterResponse> {
  const normalizedApiKey = normalizeApiKey(apiKey);
  if (!normalizedApiKey) {
    throw new Error("OpenRouter API key is empty. Add it in Settings.");
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${normalizedApiKey}`,
      "HTTP-Referer": OPENROUTER_REFERER,
      "X-Title": OPENROUTER_TITLE,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw await buildOpenRouterError(response);
  }

  return (await response.json()) as OpenRouterResponse;
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

  const body = {
      model,
      messages,
      max_tokens: 200,
      temperature: 0.7,
    } as OpenRouterRequest;
  const data = await postOpenRouter(apiKey, body);

  if (!data.choices || data.choices.length === 0) {
    throw new Error("No response from OpenRouter API");
  }

  return data.choices[0].message.content.trim();
}

export async function generateImage(
  apiKey: string,
  prompt: string,
  model: string = "google/gemini-2.5-flash-image-preview", // Use a model that supports image generation
  aspectRatio: string = "21:9" // Badge is 250x122 ≈ 2.05:1, closest supported is 21:9 (2.33:1)
): Promise<string> {
  // Match the OpenRouter example format exactly
  const messages: OpenRouterMessage[] = [
    {
      role: "user",
      content: prompt, // Use prompt directly, don't add "Generate an image:"
    },
  ];

  const body = {
    model,
    messages,
    modalities: ["image", "text"] as string[], // Explicitly request image generation
    stream: false, // Don't stream the response
    image_config: {
      aspect_ratio: aspectRatio,
      image_size: "1K", // 1024x1024 base, will be scaled by aspect ratio
    },
  };

  console.log("=== OpenRouter Image Generation Request ===");
  console.log("Model:", model);
  console.log("Full request body:", JSON.stringify(body, null, 2));
  console.log("=== End Request ===");

  const data = await postOpenRouter(apiKey, body);

  // Log the full response for debugging
  console.log("=== OpenRouter Full Response ===");
  console.log(JSON.stringify(data, null, 2));
  console.log("=== End Full Response ===");

  if (!data.choices || data.choices.length === 0) {
    throw new Error("No response from OpenRouter API");
  }

  const message = data.choices[0].message;

  // Log the actual response message structure for debugging
  console.log("=== OpenRouter Message Structure ===");
  console.log(JSON.stringify(message, null, 2));
  console.log("Message keys:", Object.keys(message));
  if (message.images) {
    console.log("Images array length:", message.images.length);
    console.log(
      "First image structure:",
      JSON.stringify(message.images[0], null, 2)
    );
  }
  console.log("=== End Message Structure ===");

  // Check for images in the response structure
  // OpenRouter API returns: image.image_url.url (snake_case) in raw API responses
  // TypeScript SDK converts to: image.imageUrl.url (camelCase)
  if (message.images && message.images.length > 0) {
    const firstImage = message.images[0] as any; // Use any to handle both formats

    // Try snake_case format first (raw API response): image.image_url.url
    if (firstImage.image_url && firstImage.image_url.url) {
      const imageUrl = firstImage.image_url.url;
      console.log(
        "Found image URL (snake_case, first 100 chars):",
        imageUrl.substring(0, 100)
      );
      return imageUrl; // Already a data URL (data:image/png;base64,...)
    }

    // Try camelCase format (SDK converted): image.imageUrl.url
    if (firstImage.imageUrl && firstImage.imageUrl.url) {
      const imageUrl = firstImage.imageUrl.url;
      console.log(
        "Found image URL (camelCase, first 100 chars):",
        imageUrl.substring(0, 100)
      );
      return imageUrl; // Already a data URL (data:image/png;base64,...)
    }

    // Fallback: direct url property
    if (firstImage.url) {
      return firstImage.url;
    }

    // Fallback: image_url or imageUrl might be a string directly
    if (typeof firstImage.image_url === "string") {
      return firstImage.image_url;
    }
    if (typeof firstImage.imageUrl === "string") {
      return firstImage.imageUrl;
    }

    console.error(
      "Unexpected image structure:",
      JSON.stringify(firstImage, null, 2)
    );
  }

  // Check if image URL is in content (some models return it as text/markdown)
  if (message.content) {
    // Try to extract URL from markdown image syntax: ![alt](url)
    const markdownImageMatch = message.content.match(/!\[.*?\]\((.*?)\)/);
    if (markdownImageMatch && markdownImageMatch[1]) {
      return markdownImageMatch[1];
    }

    // Try to extract any HTTP/HTTPS URL
    const urlMatch = message.content.match(/https?:\/\/[^\s\)]+/);
    if (urlMatch && urlMatch[0]) {
      return urlMatch[0];
    }
  }

  // Fallback: log the full response for debugging
  console.error("=== ERROR: No image found in response ===");
  console.error("Full message object:", JSON.stringify(message, null, 2));
  console.error("Message has images?", !!message.images);
  console.error("Message has content?", !!message.content);
  if (message.content) {
    console.error("Content preview:", message.content.substring(0, 200));
  }
  console.error("=== End Error Details ===");
  throw new Error(
    "No image found in response. Check console logs above for full response structure."
  );
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
  { id: "google/gemini-2.0-flash-exp:free", name: "Gemini 2.0 Flash (Free)" },
  { id: "google/gemini-2.5-flash-image", name: "Gemini 2.5 Flash Image" },
  { id: "openai/dall-e-3", name: "DALL-E 3" },
  { id: "openai/dall-e-2", name: "DALL-E 2" },
  // Note: Models with image generation support may vary
];

const INK_BLOT_PROMPT_PREFIX =
  "Create a mirrored Rorschach-style ink blot for a 250x122 e-ink display. Pure 1-bit black and white only, no grayscale. Single central blot mass with bilateral vertical symmetry, organic edges, subtle grain/noise texture, strong contrast, white paper background. Abstract emotional shape only; no people, no objects, no symbols, no letters, no numbers, no icons, no frames, no borders. Keep the blot centered with clean negative space around it. Crisp bitmap look suitable for dithering and very low-resolution rendering.";

// Local suggestion templates for fast, cost-effective suggestions
const DILEMMA_TEMPLATES = [
  "Should I take the promotion that requires relocating?",
  "Is it time to end this relationship?",
  "Should I buy a house or keep renting?",
  "Do I quit my stable job to start my own business?",
  "Should I confront my friend about what they said?",
  "Is it worth going into debt for this degree?",
  "Should I tell my family the truth about...",
  "Do I prioritize my career or my relationship?",
];

const VALUE_TEMPLATES = [
  "Financial security",
  "Personal growth",
  "Family time",
  "Career advancement",
  "Health and wellness",
  "Creative expression",
  "Social connection",
  "Independence",
  "Stability",
  "Adventure",
  "Recognition",
  "Autonomy",
  "Learning",
  "Compassion",
  "Honesty",
  "Loyalty",
];

// Cache for API suggestions to avoid repeated calls
const suggestionCache = new Map<string, string[]>();

/**
 * Generate a prophecy based on a dilemma and two selected values
 */
export async function generateProphecy(
  apiKey: string,
  dilemma: string,
  value1: string,
  value2: string
): Promise<{ prophecyText: string; imagePrompt: string }> {
  const systemPrompt = `You are an oracle generating ONE prophecy at a time.

Each prophecy must reveal ONE emotionally honest outcome that emerges from a combination of TWO values. The prophecy's purpose is to help the seeker understand their dilemma by FEELING one possible future.

The prophecy must function as:
- A PRESSURE POINT — touching a sensitive truth
- A REVEALING ANGLE — showing the dilemma from an unexpected side
- A SMALL FICTION that unlocks a big feeling — short, but emotionally resonant

Conflicts between values are ALLOWED. When they appear, the prophecy must highlight that tension clearly.
- Harmony between values should feel grounding or affirming
- Tension between values should feel sharp or unsettling

PROPHECY RULES:
- Maximum 80 characters, ONE sentence
- Fortune-cookie-style oracle whisper
- State ONE concrete outcome of choosing
- Clear, direct, and emotionally evocative
- Reveal either HARMONY or CONFLICT between the values
- Offer REFLECTION, not advice

IMAGE SUBJECT (6-20 words): Abstract emotional descriptors for an ink blot aesthetic. Do NOT describe literal scenes or objects. Focus on mood/tension words like "fractured calm, heavy pressure, anxious symmetry, brittle hope".

Respond ONLY in this JSON format:
{
  "prophecy": "your prophecy text here",
  "imagePrompt": "concrete visual scene"
}`;

  const userPrompt = `Dilemma: ${dilemma}
Value 1: ${value1}
Value 2: ${value2}`;

  let response: string;
  try {
    response = await generateText(apiKey, userPrompt, "openai/gpt-4o-mini", systemPrompt);
  } catch (error) {
    if (!shouldFallbackModel(error)) {
      throw error;
    }
    console.warn(
      "[OpenRouter] Primary text model unavailable, retrying with openrouter/auto."
    );
    response = await generateText(apiKey, userPrompt, "openrouter/auto", systemPrompt);
  }

  try {
    const parsed = JSON.parse(response);
    return {
      prophecyText: parsed.prophecy || parsed.prophecyText || response,
      imagePrompt: parsed.imagePrompt || parsed.image_prompt || "uneasy balance, restrained tension, fragile calm",
    };
  } catch {
    return {
      prophecyText: response.slice(0, 80),
      imagePrompt: "uneasy balance, restrained tension, fragile calm",
    };
  }
}

/**
 * Generate prophecy image based on the prophecy text
 */
export async function generateProphecyImage(
  apiKey: string,
  imagePrompt: string
): Promise<string> {
  const fullPrompt = `${INK_BLOT_PROMPT_PREFIX} Mood cues: ${imagePrompt}.`;
  return generateImage(apiKey, fullPrompt, "google/gemini-2.5-flash-image", "1:1");
}

/**
 * Generate quick suggestions for dilemma input
 * Uses local templates first, falls back to lightweight API call
 */
export async function generateDilemmaSuggestions(
  apiKey: string,
  count: number = 3
): Promise<string[]> {
  // Always include some templates for instant display
  const shuffled = [...DILEMMA_TEMPLATES].sort(() => Math.random() - 0.5);
  const templates = shuffled.slice(0, count);

  // If no API key, just return templates
  if (!apiKey) {
    return templates;
  }

  // Check cache
  const cacheKey = `dilemma_${count}`;
  const cached = suggestionCache.get(cacheKey);
  if (cached && Date.now() - (suggestionCache.get(`${cacheKey}_time`) as number || 0) < 300000) {
    return cached;
  }

  try {
    // Lightweight API call for fresh suggestions
    const systemPrompt = `You are a helpful assistant generating brief dilemma starters. Generate ${count} short, relatable dilemma questions (under 60 chars each). Return as JSON array: {"suggestions":["...", "...", "..."]}`;

    const response = await generateText(apiKey, "Generate dilemma examples", "openai/gpt-4o-mini", systemPrompt);

    try {
      const parsed = JSON.parse(response);
      const suggestions = parsed.suggestions || parsed.dilemmas || [];
      if (suggestions.length > 0) {
        // Cache results
        suggestionCache.set(cacheKey, suggestions);
        suggestionCache.set(`${cacheKey}_time`, Date.now());
        return suggestions.slice(0, count);
      }
    } catch {
      // JSON parse failed, return templates
    }
  } catch (e) {
    // API call failed, return templates silently
    console.log("Suggestion API failed, using templates:", e);
  }

  return templates;
}

/**
 * Generate quick suggestions for value input
 */
export async function generateValueSuggestions(
  apiKey: string,
  dilemma?: string,
  count: number = 4
): Promise<string[]> {
  // Always include templates
  const shuffled = [...VALUE_TEMPLATES].sort(() => Math.random() - 0.5);
  const templates = shuffled.slice(0, count);

  // If no API key or no dilemma context, just return templates
  if (!apiKey || !dilemma) {
    return templates;
  }

  // Check cache
  const cacheKey = `value_${dilemma.slice(0, 30)}_${count}`;
  const cached = suggestionCache.get(cacheKey);
  if (cached && Date.now() - (suggestionCache.get(`${cacheKey}_time`) as number || 0) < 300000) {
    return cached;
  }

  try {
    // Contextual suggestions based on dilemma
    const systemPrompt = `Given a dilemma, suggest ${count} core values that might be relevant. Return as JSON: {"suggestions":["value1", "value2", ...]}. Keep each under 20 chars.`;
    const userPrompt = `Dilemma: ${dilemma.slice(0, 100)}`;

    const response = await generateText(apiKey, userPrompt, "openai/gpt-4o-mini", systemPrompt);

    try {
      const parsed = JSON.parse(response);
      const suggestions = parsed.suggestions || parsed.values || [];
      if (suggestions.length > 0) {
        const result = suggestions.slice(0, count);
        suggestionCache.set(cacheKey, result);
        suggestionCache.set(`${cacheKey}_time`, Date.now());
        return result;
      }
    } catch {
      // JSON parse failed
    }
  } catch (e) {
    console.log("Value suggestion API failed, using templates:", e);
  }

  return templates;
}
