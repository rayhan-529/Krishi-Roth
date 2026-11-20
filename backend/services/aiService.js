/**
 * AI agricultural assistant.
 *
 * Settings in backend/.env:
 *   AI_PROVIDER = gemini (default) | openai | anthropic
 *   AI_API_KEY  = the provider's secret key (never sent to the browser)
 *   AI_MODEL    = optional model override
 *   AI_FALLBACK_MODEL = optional backup models (comma separated), tried in order when the main one is slow or down
 *
 * When AI_API_KEY is empty the chatbot reports "not configured" instead of
 * pretending to work. Calls use the providers' REST APIs with fetch, so no
 * extra npm packages are needed.
 */
const PROVIDERS = {
  gemini: { label: "Google Gemini", defaultModel: "gemini-3.5-flash-lite", fallbackModel: "gemini-3.1-flash-lite,gemini-3-flash-preview" },
  openai: { label: "OpenAI", defaultModel: "gpt-4.1-mini" },
  anthropic: { label: "Anthropic Claude", defaultModel: "claude-haiku-4-5" }
};

// Per attempt. A farmer should not wait longer than this for one model; the backup model gets its own try.
const TIMEOUT_MS = 20 * 1000; // 3 models x 20s stays under the website's 75s limit
const MAX_OUTPUT_TOKENS = 1200;

function settings() {
  const provider = (process.env.AI_PROVIDER || "gemini").trim().toLowerCase();
  const apiKey = (process.env.AI_API_KEY || "").trim();
  const known = PROVIDERS[provider];
  return {
    provider: known ? provider : "gemini",
    label: (known || PROVIDERS.gemini).label,
    model: (process.env.AI_MODEL || "").trim() || (known || PROVIDERS.gemini).defaultModel,
    fallbackModel: (process.env.AI_FALLBACK_MODEL || "").trim() || (known || PROVIDERS.gemini).fallbackModel || "",
    apiKey,
    configured: Boolean(apiKey) && Boolean(known)
  };
}

function systemPrompt(language) {
  return [
    "You are 'Krishi Roth Sahayak' (কৃষি রথ সহায়ক), an agricultural assistant for farmers in Bangladesh, inside the Krishi Roth platform.",
    language === "en"
      ? "Reply in simple English unless the farmer writes in Bengali."
      : "Reply in simple, everyday Bengali (বাংলা) unless the farmer writes in English. Use words a rural farmer understands.",
    "Help with: crop care, fertilizer and irrigation, pests and crop diseases, harvesting time, seed rates for a land size, storage, and lowering production costs.",
    "Keep answers short and practical: use short paragraphs or numbered steps. Use Bangladeshi units where useful (শতাংশ/decimal, বিঘা, কাঠা, মণ, কেজি).",
    "Always write numbers with English digits 0-9 (for example '20 কেজি', '৳ 1,500'), never Bengali digits, even in a Bengali reply.",
    "Fertilizer and pesticide advice must be general: tell the farmer to follow the product label and to confirm doses with the Upazila Agriculture Officer (উপজেলা কৃষি কর্মকর্তা) or the government agriculture call centre (16123).",
    "If a disease is described without enough detail, list the likely causes and say what to check; do not claim certainty.",
    "Do not invent market prices. Tell the farmer to check the Krishi Roth market price page or the local market.",
    "If the question is not about agriculture or farm business, politely say you can only help with farming topics.",
    "Never give dangerous instructions (for example mixing chemicals or using banned pesticides)."
  ].join("\n");
}

class AiError extends Error {
  constructor(kind, detail) {
    super(detail || kind);
    this.kind = kind; // "not_configured" | "rate_limited" | "auth" | "blocked" | "failed"
  }
}

async function post(url, headers, body) {
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
  } catch (error) {
    throw new AiError(error.name === "TimeoutError" ? "busy" : "failed", `Network error: ${error.message}`);
  }

  const json = await response.json().catch(() => ({}));
  if (response.status === 429) throw new AiError("rate_limited", "Provider rate limit reached");
  if (response.status === 401 || response.status === 403) throw new AiError("auth", "Provider rejected the API key");
  if (response.status === 503 || response.status === 529) throw new AiError("busy", (json.error && json.error.message) || "Provider overloaded");
  if (!response.ok) {
    const detail = (json.error && (json.error.message || json.error.type)) || `HTTP ${response.status}`;
    throw new AiError("failed", detail);
  }
  return json;
}

async function callGemini(s, system, history) {
  const generationConfig = { temperature: 0.4, maxOutputTokens: MAX_OUTPUT_TOKENS };
  // Gemini 2.5 Flash "thinks" by default, which uses up output tokens; a short chat answer does not need it.
  if (/^gemini-2\.5-flash/.test(s.model)) generationConfig.thinkingConfig = { thinkingBudget: 0 };

  const json = await post(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(s.model)}:generateContent`,
    { "x-goog-api-key": s.apiKey },
    {
      system_instruction: { parts: [{ text: system }] },
      contents: history.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      generationConfig
    }
  );

  const candidate = json.candidates && json.candidates[0];
  if (!candidate) throw new AiError("blocked", "No answer returned");
  const text = ((candidate.content && candidate.content.parts) || [])
    .filter((part) => part.text && !part.thought)
    .map((part) => part.text)
    .join("")
    .trim();
  if (!text) throw new AiError(candidate.finishReason === "SAFETY" ? "blocked" : "failed", candidate.finishReason);
  return text;
}

async function callOpenAI(s, system, history) {
  const json = await post(
    "https://api.openai.com/v1/chat/completions",
    { Authorization: `Bearer ${s.apiKey}` },
    {
      model: s.model,
      temperature: 0.4,
      max_completion_tokens: MAX_OUTPUT_TOKENS,
      messages: [{ role: "system", content: system }, ...history.map((m) => ({ role: m.role, content: m.content }))]
    }
  );
  const text = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
  if (!text) throw new AiError("failed", "Empty answer");
  return text.trim();
}

async function callAnthropic(s, system, history) {
  const json = await post(
    "https://api.anthropic.com/v1/messages",
    { "x-api-key": s.apiKey, "anthropic-version": "2023-06-01" },
    {
      model: s.model,
      max_tokens: MAX_OUTPUT_TOKENS,
      temperature: 0.4,
      system,
      messages: history.map((m) => ({ role: m.role, content: m.content }))
    }
  );
  const text = (json.content || []).filter((block) => block.type === "text").map((block) => block.text).join("").trim();
  if (!text) throw new AiError("failed", "Empty answer");
  return text;
}

/**
 * Asks the configured AI provider for the next reply.
 * @param {Array<{role: "user"|"assistant", content: string}>} history  oldest first, ends with the user's question
 * @param {"bn"|"en"} language
 * @returns {Promise<{ text: string, provider: string, model: string }>}
 */
async function generateReply(history, language) {
  const s = settings();
  if (!s.configured) throw new AiError("not_configured");

  const system = systemPrompt(language);
  const call = { gemini: callGemini, openai: callOpenAI, anthropic: callAnthropic }[s.provider];
  return withFallback(s, async (model) => ({ text: latinDigits(await call({ ...s, model }, system, history)), provider: s.provider, model }));
}

/** The site shows English digits everywhere; small models sometimes still write ১২৩. */
function latinDigits(text) {
  return String(text).replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6));
}

/**
 * Runs fn with the main model; if that model times out, is overloaded or no longer
 * exists, tries the backup model once. Key, quota and safety errors are not retried.
 */
async function withFallback(s, fn) {
  const models = [s.model, ...s.fallbackModel.split(",").map((m) => m.trim())].filter((m, i, all) => m && all.indexOf(m) === i);
  let lastError;
  for (const model of models) {
    try {
      return await fn(model);
    } catch (error) {
      const retryable = error instanceof AiError && (error.kind === "failed" || error.kind === "busy");
      if (!retryable) throw error;
      console.warn(`AI model ${model} failed (${error.message})`);
      lastError = error;
    }
  }
  // Every model was down or overloaded: tell the farmer to try again shortly.
  throw lastError.kind === "busy" ? new AiError("rate_limited", lastError.message) : lastError;
}

// ------------------------------------------------------------ crop doctor (image)
const DIAGNOSIS_FIELDS = `{
  "is_plant": true or false (false if the photo is not a crop, leaf, fruit or plant),
  "crop": "crop name, or empty",
  "healthy": true or false,
  "problem": "short name of the disease, pest or deficiency, or empty when healthy",
  "confidence": "low" | "medium" | "high",
  "summary": "1-2 simple sentences",
  "symptoms": ["what is visible in the photo"],
  "causes": ["likely causes"],
  "treatment": ["practical steps, organic first, then chemical by generic name"],
  "prevention": ["how to avoid it next time"],
  "see_expert": true or false (true when serious, spreading fast or unsure)
}`;

function diagnosisPrompt(language, hints) {
  return [
    "You are 'Krishi Roth Crop Doctor', a plant-health assistant for farmers in Bangladesh.",
    "Look at the photo and identify the crop and any disease, pest damage or nutrient deficiency.",
    language === "en"
      ? "Write every text value in simple English."
      : "Write every text value in simple, everyday Bengali (বাংলা) that a rural farmer understands.",
    "Always write numbers with English digits 0-9.",
    "Pesticide and fertilizer advice must be general: say to follow the product label and confirm with the Upazila Agriculture Officer or call 16123.",
    "If the photo is unclear, use confidence \"low\" and say what to photograph instead. Never claim certainty you do not have.",
    hints.crop ? `The farmer says the crop is: ${hints.crop}.` : "",
    hints.note ? `The farmer's note: ${hints.note}` : "",
    `Reply with ONLY a JSON object, no markdown, in exactly this shape:\n${DIAGNOSIS_FIELDS}`
  ].filter(Boolean).join("\n");
}

function parseDiagnosis(text) {
  const match = String(text).match(/\{[\s\S]*\}/);
  if (!match) throw new AiError("failed", "No JSON in the answer");
  let data;
  try {
    data = JSON.parse(match[0]);
  } catch {
    throw new AiError("failed", "Invalid JSON in the answer");
  }
  const list = (v) => (Array.isArray(v) ? v.map(String).filter(Boolean).slice(0, 8) : []);
  return {
    is_plant: data.is_plant !== false,
    crop: String(data.crop || "").slice(0, 80),
    healthy: Boolean(data.healthy),
    problem: String(data.problem || "").slice(0, 120),
    confidence: ["low", "medium", "high"].includes(data.confidence) ? data.confidence : "low",
    summary: String(data.summary || "").slice(0, 600),
    symptoms: list(data.symptoms),
    causes: list(data.causes),
    treatment: list(data.treatment),
    prevention: list(data.prevention),
    see_expert: Boolean(data.see_expert)
  };
}

async function visionGemini(s, prompt, image) {
  const generationConfig = { temperature: 0.2, maxOutputTokens: 2000, responseMimeType: "application/json" };
  if (/^gemini-2\.5-flash/.test(s.model)) generationConfig.thinkingConfig = { thinkingBudget: 0 };
  const json = await post(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(s.model)}:generateContent`,
    { "x-goog-api-key": s.apiKey },
    {
      contents: [{ role: "user", parts: [{ inline_data: { mime_type: image.mimeType, data: image.base64 } }, { text: prompt }] }],
      generationConfig
    }
  );
  const candidate = json.candidates && json.candidates[0];
  if (!candidate) throw new AiError("blocked", "No answer returned");
  return ((candidate.content && candidate.content.parts) || []).filter((p) => p.text && !p.thought).map((p) => p.text).join("");
}

async function visionOpenAI(s, prompt, image) {
  const json = await post(
    "https://api.openai.com/v1/chat/completions",
    { Authorization: `Bearer ${s.apiKey}` },
    {
      model: s.model,
      temperature: 0.2,
      max_completion_tokens: 2000,
      response_format: { type: "json_object" },
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:${image.mimeType};base64,${image.base64}` } }
        ]
      }]
    }
  );
  return (json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content) || "";
}

async function visionAnthropic(s, prompt, image) {
  const json = await post(
    "https://api.anthropic.com/v1/messages",
    { "x-api-key": s.apiKey, "anthropic-version": "2023-06-01" },
    {
      model: s.model,
      max_tokens: 2000,
      temperature: 0.2,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: image.mimeType, data: image.base64 } },
          { type: "text", text: prompt }
        ]
      }]
    }
  );
  return (json.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
}

/**
 * Diagnoses a crop photo.
 * @param {{ buffer: Buffer, mimeType: string }} photo  jpeg/png/webp
 * @param {{ crop?: string, note?: string }} hints
 * @param {"bn"|"en"} language
 */
async function diagnoseCropImage(photo, hints, language) {
  const s = settings();
  if (!s.configured) throw new AiError("not_configured");
  const image = { mimeType: photo.mimeType, base64: photo.buffer.toString("base64") };
  const call = { gemini: visionGemini, openai: visionOpenAI, anthropic: visionAnthropic }[s.provider];
  const prompt = diagnosisPrompt(language, hints);
  return withFallback(s, async (model) => ({ ...parseDiagnosis(latinDigits(await call({ ...s, model }, prompt, image))), provider: s.provider, model }));
}

function status() {
  const s = settings();
  return { configured: s.configured, provider: s.provider, provider_label: s.label, model: s.configured ? s.model : null };
}

module.exports = { generateReply, diagnoseCropImage, status, AiError };
