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
  { id: "google/gemini-2.5-flash-image-preview", name: "Gemini 2.5 Flash Image" },
  { id: "openai/dall-e-3", name: "DALL-E 3" },
  { id: "openai/dall-e-2", name: "DALL-E 2" },
  // Note: Models with image generation support may vary
];

const HALFTONE_PROMPT_PREFIX =
  "A coarse halftone black-and-white illustration made for a 250×122 e-ink display. Pure 1-bit monochrome, no grayscale. Realistic style, very large halftone dots arranged on a visible grid. High contrast silhouettes with simplified shapes, strong blacks, and blown-out whites. Sharp edges, no anti-aliasing, no smooth gradients. Bitmap texture, heavy dithering, blocky pixel clusters. Composition must remain good quality at extremely low resolution.";

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

IMAGE SUBJECT (10-30 words): A concrete visual scene that captures the prophecy's emotional core. NOT abstract symbols. Think: "a person standing at a crossroads at dusk", "hands releasing a bird into fog", "an empty chair facing two doors". Evocative but drawable.

Respond ONLY in this JSON format:
{
  "prophecy": "your prophecy text here",
  "imagePrompt": "concrete visual scene"
}`;

  const userPrompt = `Dilemma: ${dilemma}
Value 1: ${value1}
Value 2: ${value2}`;

  const response = await generateText(
    apiKey,
    userPrompt,
    "openai/gpt-4o-mini",
    systemPrompt
  );

  try {
    const parsed = JSON.parse(response);
    return {
      prophecyText: parsed.prophecy || parsed.prophecyText || response,
      imagePrompt: parsed.imagePrompt || parsed.image_prompt || "crystal ball",
    };
  } catch {
    return {
      prophecyText: response.slice(0, 80),
      imagePrompt: "an empty chair facing two doors",
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
  const fullPrompt = HALFTONE_PROMPT_PREFIX + imagePrompt;
  return generateImage(apiKey, fullPrompt, "google/gemini-2.5-flash-image-preview", "1:1");
}
