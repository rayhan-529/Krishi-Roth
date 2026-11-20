/**
 * Chatbot knowledge base (RAG = Retrieval-Augmented Generation).
 *
 *   1. An admin adds a document (text, .txt, .md, .docx or .pdf).
 *   2. It is split into overlapping chunks of a few paragraphs.
 *   3. Each chunk gets an embedding (see embeddingService) and is saved.
 *   4. For every question we embed the question, find the closest chunks and
 *      give them to the AI, which answers from them and names the source.
 *
 * All chunk vectors are kept in memory (a few thousand chunks = a few MB), so a
 * search is a fast in-process dot product with no extra vector database.
 */
const fs = require("fs");
const path = require("path");
const db = require("../config/db");
const emb = require("./embeddingService");

const CHUNK_CHARS = 900; // about 1-2 paragraphs
const OVERLAP_CHARS = 150; // repeated between chunks so facts on a boundary are not lost
const MIN_SCORE = 0.62; // below this a chunk is not really about the question (tested: unrelated text scores about 0.58)
const MAX_DOC_CHARS = 400000; // about 150 pages of text per document

const SITE_GUIDE_TITLE = "Krishi Roth site guide (কৃষি রথ ব্যবহার নির্দেশিকা)";
const SITE_GUIDE_FILE = path.join(__dirname, "..", "knowledge", "site-guide.md");

let cache = null; // [{ id, documentId, title, source, content, vector }]

// ------------------------------------------------------------ text extraction
/** Reads plain text out of an uploaded file. */
async function extractText(file) {
  const name = (file.originalname || "").toLowerCase();
  if (name.endsWith(".pdf")) {
    const { PDFParse } = require("pdf-parse");
    const parser = new PDFParse({ data: file.buffer });
    try {
      return (await parser.getText()).text;
    } finally {
      await parser.destroy().catch(() => {});
    }
  }
  if (name.endsWith(".docx")) {
    const mammoth = require("mammoth");
    return (await mammoth.extractRawText({ buffer: file.buffer })).value;
  }
  return file.buffer.toString("utf8"); // .txt / .md
}

/** Tidies extracted text: one space between words, at most one blank line. */
function clean(text) {
  return String(text || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ------------------------------------------------------------ chunking
/** Splits a long paragraph at sentence ends (. ? ! and the Bangla দাঁড়ি ।). */
function sentences(paragraph) {
  return paragraph.match(/[^.?!।]+[.?!।]+["')\]]*\s*|[^.?!।]+$/g) || [paragraph];
}

/**
 * Splits text into chunks of about CHUNK_CHARS, keeping paragraphs and
 * sentences whole and carrying OVERLAP_CHARS of context into the next chunk.
 * A Markdown heading is repeated at the top of each chunk under it, so a chunk
 * about "Withdraw" still says which section it came from.
 */
function chunkText(text) {
  const blocks = clean(text).split(/\n\n+/);
  const chunks = [];
  let heading = "";
  let current = "";

  const flush = () => {
    const body = current.trim();
    if (body.length >= 40) chunks.push(heading && !body.startsWith(heading) ? `${heading}\n${body}` : body);
    current = body.length > OVERLAP_CHARS ? body.slice(-OVERLAP_CHARS).replace(/^\S*\s/, "") : "";
  };

  for (const block of blocks) {
    if (/^#{1,4} /.test(block)) {
      if (current.trim()) flush();
      current = "";
      heading = block.split("\n")[0].replace(/^#+ /, "").trim();
      const rest = block.split("\n").slice(1).join("\n");
      if (rest) current = rest;
      continue;
    }
    const pieces = block.length > CHUNK_CHARS ? sentences(block) : [block];
    for (const piece of pieces) {
      if (current.length + piece.length + 2 > CHUNK_CHARS && current.trim()) flush();
      current += (current ? (pieces.length > 1 ? " " : "\n\n") : "") + piece.trim();
    }
  }
  if (current.trim()) flush();
  return chunks;
}

// ------------------------------------------------------------ storage
async function loadCache() {
  const [rows] = await db.query(
    `SELECT c.id, c.document_id, c.content, c.embedding, d.title, d.source
     FROM kb_chunks c JOIN kb_documents d ON d.id = c.document_id`
  );
  cache = rows.map((r) => ({
    id: r.id,
    documentId: r.document_id,
    title: r.title,
    source: r.source,
    content: r.content,
    vector: emb.fromBuffer(r.embedding)
  }));
  return cache;
}

function invalidate() {
  cache = null;
}

/**
 * Splits, embeds and saves a document.
 * @returns {Promise<{ id: number, chunk_count: number, char_count: number }>}
 */
async function addDocument({ title, text, source = null, fileName = null, userId = null, builtin = false }) {
  const body = clean(text).slice(0, MAX_DOC_CHARS);
  const chunks = chunkText(body);
  if (chunks.length === 0) {
    const error = new Error("No readable text");
    error.kind = "empty";
    throw error;
  }
  // Embed first: if the AI service fails, nothing half-done is saved.
  const vectors = await emb.embed(chunks.map((c) => `${title}\n${c}`), "RETRIEVAL_DOCUMENT");

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [doc] = await conn.query(
      "INSERT INTO kb_documents (title, source, file_name, char_count, chunk_count, is_builtin, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [title, source, fileName, body.length, chunks.length, builtin ? 1 : 0, userId]
    );
    for (let i = 0; i < chunks.length; i += 200) {
      const rows = chunks.slice(i, i + 200).map((content, j) => [doc.insertId, i + j, content, emb.toBuffer(vectors[i + j])]);
      await conn.query("INSERT INTO kb_chunks (document_id, chunk_index, content, embedding) VALUES ?", [rows]);
    }
    await conn.commit();
    invalidate();
    return { id: doc.insertId, chunk_count: chunks.length, char_count: body.length };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function deleteDocument(id) {
  const [result] = await db.query("DELETE FROM kb_documents WHERE id = ?", [id]);
  invalidate();
  return result.affectedRows > 0;
}

async function listDocuments() {
  const [rows] = await db.query(
    `SELECT d.id, d.title, d.source, d.file_name, d.char_count, d.chunk_count, d.is_builtin, d.created_at, u.name AS created_by_name
     FROM kb_documents d LEFT JOIN users u ON u.id = d.created_by ORDER BY d.is_builtin DESC, d.created_at DESC`
  );
  return rows;
}

async function documentChunks(id) {
  const [rows] = await db.query("SELECT chunk_index, content FROM kb_chunks WHERE document_id = ? ORDER BY chunk_index", [id]);
  return rows;
}

// ------------------------------------------------------------ search
/**
 * Finds the chunks closest in meaning to the question.
 * @returns {Promise<Array<{ id, documentId, title, source, content, score }>>}
 */
async function search(question, { limit = 5, minScore = MIN_SCORE } = {}) {
  const chunks = cache || (await loadCache());
  if (chunks.length === 0 || !emb.isConfigured()) return [];
  const q = await emb.embedQuery(question);
  const scored = [];
  for (const c of chunks) {
    let score = 0;
    for (let i = 0; i < q.length; i++) score += q[i] * c.vector[i];
    if (score >= minScore) scored.push({ ...c, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(({ vector, ...rest }) => rest);
}

// ------------------------------------------------------------ built-in site guide
/**
 * Loads backend/knowledge/site-guide.md into the knowledge base the first time
 * (and again whenever the file changes), so the chatbot can explain the site.
 */
async function syncSiteGuide() {
  if (!emb.isConfigured() || !fs.existsSync(SITE_GUIDE_FILE)) return null;
  const text = fs.readFileSync(SITE_GUIDE_FILE, "utf8");
  const [rows] = await db.query("SELECT id, char_count FROM kb_documents WHERE is_builtin = 1 AND title = ?", [SITE_GUIDE_TITLE]);
  const existing = rows[0];
  if (existing && existing.char_count === clean(text).length) return null;
  const added = await addDocument({ title: SITE_GUIDE_TITLE, text, source: "krishiroth.com", fileName: "site-guide.md", builtin: true });
  if (existing) await deleteDocument(existing.id);
  return added;
}

module.exports = { extractText, chunkText, addDocument, deleteDocument, listDocuments, documentChunks, search, syncSiteGuide, MIN_SCORE };
