/**
 * Admin: the chatbot's knowledge base (RAG).
 *   GET    /api/admin/knowledge              list documents
 *   POST   /api/admin/knowledge              add (multipart "file" .txt/.md/.docx/.pdf, or "text")
 *   GET    /api/admin/knowledge/:id          the chunks of one document
 *   DELETE /api/admin/knowledge/:id          remove a document
 *   POST   /api/admin/knowledge/search       try a question: which passages would be used
 */
const multer = require("multer");
const v = require("../utils/validator");
const ApiError = require("../utils/ApiError");
const { send } = require("../utils/response");
const kb = require("../services/knowledgeService");
const emb = require("../services/embeddingService");
const { logActivity } = require("../services/activityService");

const MAX_FILE_MB = 10;
const TYPES = [".txt", ".md", ".docx", ".pdf"];

const schemas = {
  add: {
    title: v.string().required().min(3).max(200),
    source: v.string().max(300),
    text: v.string().max(400000)
  },
  search: { question: v.string().required().min(2).max(500) }
};

const fileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_MB * 1024 * 1024, files: 1, fields: 5, fieldSize: 2 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const name = (file.originalname || "").toLowerCase();
    if (TYPES.some((ext) => name.endsWith(ext))) return cb(null, true);
    return cb(ApiError.badRequest("শুধু .txt, .md, .docx বা .pdf ফাইল দিন।", "Please upload a .txt, .md, .docx or .pdf file."));
  }
}).single("file");

/** Wraps multer so its errors become friendly messages. */
function receiveFile(req, res, next) {
  fileUpload(req, res, (err) => {
    if (!err) return next();
    if (err instanceof ApiError) return next(err);
    if (err.code === "LIMIT_FILE_SIZE") return next(ApiError.badRequest(`ফাইলটি ${MAX_FILE_MB} MB-এর বেশি বড়।`, `The file is larger than ${MAX_FILE_MB} MB.`));
    return next(ApiError.badRequest("ফাইলটি পড়া যায়নি।", "The file could not be read."));
  });
}

const EMBED_ERRORS = {
  not_configured: [503, "এআই key দেওয়া নেই, তাই জ্ঞানভান্ডার চালু করা যাচ্ছে না।", "No AI key is set, so the knowledge base cannot be used."],
  auth: [503, "এআই key সঠিক নয়।", "The AI key is not valid."],
  rate_limited: [503, "এআই সেবা এখন ব্যস্ত। এক মিনিট পর আবার চেষ্টা করুন।", "The AI service is busy. Please try again in a minute."],
  failed: [502, "ডকুমেন্ট প্রসেস করা যায়নি। আবার চেষ্টা করুন।", "The document could not be processed. Please try again."]
};

function embedError(error) {
  if (!(error instanceof emb.EmbeddingError)) return error;
  console.error(`[knowledge] embedding ${error.kind}: ${error.message}`);
  const [status, bn, en] = EMBED_ERRORS[error.kind] || EMBED_ERRORS.failed;
  return new ApiError(status, bn, en);
}

async function list(req, res) {
  send(req, res, { data: { documents: await kb.listDocuments(), configured: emb.isConfigured() } });
}

async function chunks(req, res) {
  send(req, res, { data: await kb.documentChunks(req.params.id) });
}

async function add(req, res) {
  let text = req.body.text || "";
  if (req.file) {
    try {
      text = await kb.extractText(req.file);
    } catch (error) {
      console.error("[knowledge] extract:", error.message);
      throw ApiError.badRequest("ফাইল থেকে লেখা পড়া যায়নি। অন্য ফরম্যাটে (.docx বা .txt) দিয়ে দেখুন।", "Could not read text from the file. Try .docx or .txt instead.");
    }
  }
  if (text.replace(/\s/g, "").length < 50) {
    const message = { bn: "কমপক্ষে কয়েক লাইন লেখা দিন বা একটি ফাইল দিন।", en: "Add a few lines of text or a file." };
    throw ApiError.badRequest(message.bn, message.en, { text: message });
  }

  let added;
  try {
    added = await kb.addDocument({
      title: req.body.title,
      text,
      source: req.body.source || null,
      fileName: req.file ? req.file.originalname.slice(0, 200) : null,
      userId: req.user.id
    });
  } catch (error) {
    if (error.kind === "empty") throw ApiError.badRequest("ডকুমেন্টে পড়ার মতো লেখা পাওয়া যায়নি।", "No readable text was found in the document.");
    throw embedError(error);
  }
  await logActivity(req, "knowledge.add", "kb_document", added.id, `${req.body.title} (${added.chunk_count} chunks)`);
  send(req, res, { status: 201, data: added, message: [`যোগ হয়েছে: ${added.chunk_count}টি অংশ`, `Added: ${added.chunk_count} passages`] });
}

async function remove(req, res) {
  if (!(await kb.deleteDocument(req.params.id))) throw ApiError.notFound("ডকুমেন্টটি পাওয়া যায়নি।", "Document not found.");
  await logActivity(req, "knowledge.delete", "kb_document", req.params.id, "");
  send(req, res, { message: ["ডকুমেন্ট মুছে ফেলা হয়েছে।", "Document deleted."] });
}

async function search(req, res) {
  let hits;
  try {
    hits = await kb.search(req.body.question, { limit: 5, minScore: 0 });
  } catch (error) {
    throw embedError(error);
  }
  send(req, res, {
    data: hits.map((h) => ({ title: h.title, document_id: h.documentId, score: Number(h.score.toFixed(3)), used: h.score >= kb.MIN_SCORE, content: h.content }))
  });
}

module.exports = { schemas, receiveFile, list, chunks, add, remove, search };
