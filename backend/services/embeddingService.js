/**
 * Text embeddings for the chatbot knowledge base (RAG).
 *
 * An embedding turns a piece of text into a list of numbers that captures its
 * meaning, so texts about the same thing end up close together. We use Google's
 * Gemini embedding model with the same AI_API_KEY as the chatbot.
 *
 *   EMBEDDING_MODEL = optional override (default gemini-embedding-001)
 */
const MODEL = () => (process.env.EMBEDDING_MODEL || "gemini-embedding-001").trim();
const DIMENSIONS = 768;
const BATCH = 100; // the API accepts up to 100 texts per request
const TIMEOUT_MS = 30 * 1000;

class EmbeddingError extends Error {
  constructor(kind, detail) {
    super(detail || kind);
    this.kind = kind; // "not_configured" | "rate_limited" | "auth" | "failed"
  }
}

function apiKey() {
  const provider = (process.env.AI_PROVIDER || "gemini").trim().toLowerCase();
  const key = (process.env.AI_API_KEY || "").trim();
  // Embeddings need a Gemini key; other providers can still chat without RAG.
  return provider === "gemini" ? key : (process.env.EMBEDDING_API_KEY || "").trim();
}

function isConfigured() {
  return Boolean(apiKey());
}

/** Scales a vector to length 1 so a plain dot product equals cosine similarity. */
function normalize(values) {
  const v = Float32Array.from(values);
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
  const len = Math.sqrt(sum) || 1;
  for (let i = 0; i < v.length; i++) v[i] /= len;
  return v;
}

async function request(texts, taskType, attempt = 1) {
  const model = MODEL();
  let response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:batchEmbedContents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey() },
      body: JSON.stringify({
        requests: texts.map((text) => ({
          model: `models/${model}`,
          content: { parts: [{ text }] },
          taskType,
          outputDimensionality: DIMENSIONS
        }))
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
  } catch (error) {
    if (attempt < 3) return request(texts, taskType, attempt + 1);
    throw new EmbeddingError("failed", `Network error: ${error.message}`);
  }
  const json = await response.json().catch(() => ({}));
  if (response.status === 401 || response.status === 403) throw new EmbeddingError("auth", "Embedding key rejected");
  if (response.status === 429 || response.status === 503) {
    // Busy or per-minute quota: wait a little and retry (uploads of long documents hit this).
    if (attempt < 4) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 5000));
      return request(texts, taskType, attempt + 1);
    }
    throw new EmbeddingError("rate_limited", (json.error && json.error.message) || "Embedding quota reached");
  }
  if (!response.ok) throw new EmbeddingError("failed", (json.error && json.error.message) || `HTTP ${response.status}`);
  return (json.embeddings || []).map((e) => normalize(e.values));
}

/**
 * @param {string[]} texts
 * @param {"RETRIEVAL_DOCUMENT"|"RETRIEVAL_QUERY"} taskType
 * @returns {Promise<Float32Array[]>} one unit-length vector per text
 */
async function embed(texts, taskType = "RETRIEVAL_DOCUMENT") {
  if (!isConfigured()) throw new EmbeddingError("not_configured");
  const out = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const vectors = await request(texts.slice(i, i + BATCH), taskType);
    if (vectors.length !== Math.min(BATCH, texts.length - i)) throw new EmbeddingError("failed", "Wrong number of embeddings");
    out.push(...vectors);
  }
  return out;
}

async function embedQuery(text) {
  const [vector] = await embed([text], "RETRIEVAL_QUERY");
  return vector;
}

const toBuffer = (vector) => Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength);
const fromBuffer = (buffer) => new Float32Array(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));

module.exports = { embed, embedQuery, isConfigured, toBuffer, fromBuffer, EmbeddingError, DIMENSIONS };
