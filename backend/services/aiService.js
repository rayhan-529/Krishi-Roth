/**
 * AI agricultural assistant.
 *
 * Settings in backend/.env:
 *   AI_PROVIDER = gemini (default) | openai | anthropic
 *   AI_API_KEY  = the provider's secret key (never sent to the browser)
 *   AI_MODEL    = optional model override
 *
 * When AI_API_KEY is empty the chatbot reports "not configured" instead of
 * pretending to work. Calls use the providers' REST APIs with fetch, so no
 * extra npm packages are needed.
 */
const PROVIDERS = {
  gemini: { label: "Google Gemini", defaultModel: "gemini-3.5-flash" },
  openai: { label: "OpenAI", defaultModel: "gpt-4.1-mini" },
  anthropic: { label: "Anthropic Claude", defaultModel: "claude-haiku-4-5" }
};

const TIMEOUT_MS = 45 * 1000;
const MAX_OUTPUT_TOKENS = 1200;

function settings() {
  const provider = (process.env.AI_PROVIDER || "gemini").trim().toLowerCase();
  const apiKey = (process.env.AI_API_KEY || "").trim();
  const known = PROVIDERS[provider];
  return {
    provider: known ? provider : "gemini",
    label: (known || PROVIDERS.gemini).label,
    model: (process.env.AI_MODEL || "").trim() || (known || PROVIDERS.gemini).defaultModel,
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
    throw new AiError("failed", `Network error: ${error.message}`);
  }

  const json = await response.json().catch(() => ({}));
  if (response.status === 429) throw new AiError("rate_limited", "Provider rate limit reached");
  if (response.status === 401 || response.status === 403) throw new AiError("auth", "Provider rejected the API key");
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
  const text = await call(s, system, history);
  return { text, provider: s.provider, model: s.model };
}

function status() {
  const s = settings();
  return { configured: s.configured, provider: s.provider, provider_label: s.label, model: s.configured ? s.model : null };
}

module.exports = { generateReply, status, AiError };
