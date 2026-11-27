/**
 * Live notifications over Server-Sent Events (SSE).
 *
 *   GET /api/notifications/stream?ticket=...   (kept open by the browser)
 *
 * The browser's EventSource cannot send an Authorization header, so the
 * login token is never put in the URL. Instead the frontend first asks for
 * a short-lived, one-time "stream ticket" (POST /notifications/stream-ticket,
 * normal Bearer login) and opens the stream with that ticket.
 *
 * Open connections are kept in memory (userId -> set of responses), so this
 * works for ONE server instance. Running several instances would need a
 * shared channel (e.g. Redis pub/sub) to reach users on other instances.
 *
 * Nothing is lost if a connection drops: notifications are always saved in
 * MySQL first, and the browser reloads the list when it reconnects.
 */
const crypto = require("crypto");
const db = require("../config/db");

const TICKET_TTL_MS = 60 * 1000;
const HEARTBEAT_MS = 25 * 1000; // keeps proxies (Render, Nginx) from closing an idle stream
const SESSION_CHECK_MS = 60 * 1000; // logout, block or password change closes the stream within a minute
const MAX_STREAMS_PER_USER = 5; // open tabs

const tickets = new Map(); // ticket -> { userId, jti, expires }
const clients = new Map(); // userId -> Set<client>

// ---------------------------------------------------------------- tickets
function issueTicket(userId, jti) {
  const now = Date.now();
  for (const [key, t] of tickets) if (t.expires < now) tickets.delete(key);
  const ticket = crypto.randomBytes(24).toString("base64url");
  tickets.set(ticket, { userId: String(userId), jti, expires: now + TICKET_TTL_MS });
  return { ticket, expires_in: TICKET_TTL_MS / 1000 };
}

/** Returns { userId, jti } once; the ticket cannot be used again. */
function redeemTicket(ticket) {
  const t = typeof ticket === "string" ? tickets.get(ticket) : null;
  if (!t) return null;
  tickets.delete(ticket);
  return t.expires >= Date.now() ? t : null;
}

async function sessionIsValid(userId, jti) {
  const [rows] = await db.query(
    `SELECT 1 FROM user_sessions s JOIN users u ON u.id = s.user_id
     WHERE s.jti = ? AND s.user_id = ? AND s.revoked_at IS NULL AND s.expires_at > NOW() AND u.is_blocked = 0
     LIMIT 1`,
    [jti, userId]
  );
  return rows.length > 0;
}

// ---------------------------------------------------------------- streams
function write(client, event, data) {
  if (client.res.writableEnded) return;
  client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function removeClient(client) {
  clearInterval(client.heartbeat);
  clearInterval(client.sessionCheck);
  const set = clients.get(client.userId);
  if (set) {
    set.delete(client);
    if (!set.size) clients.delete(client.userId);
  }
}

/**
 * Turns the response into an event stream for this user.
 * @param {{ userId: string, jti: string }} owner  from redeemTicket()
 * @param {object} firstData  sent as the "ready" event
 */
function openStream(req, res, owner, firstData) {
  res.status(200);
  res.set({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no" // tell proxies not to buffer the stream
  });
  res.flushHeaders();
  res.write("retry: 5000\n\n");

  const client = { userId: owner.userId, jti: owner.jti, res };

  let set = clients.get(client.userId);
  if (!set) clients.set(client.userId, (set = new Set()));
  if (set.size >= MAX_STREAMS_PER_USER) {
    const oldest = set.values().next().value;
    removeClient(oldest);
    oldest.res.end();
  }
  set.add(client);

  client.heartbeat = setInterval(() => !res.writableEnded && res.write(": ping\n\n"), HEARTBEAT_MS);
  client.sessionCheck = setInterval(async () => {
    try {
      if (!(await sessionIsValid(client.userId, client.jti))) {
        write(client, "session_end", {});
        removeClient(client);
        res.end();
      }
    } catch {
      // database hiccup: keep the stream, check again next time
    }
  }, SESSION_CHECK_MS);

  req.on("close", () => removeClient(client));
  write(client, "ready", firstData);
}

function isOnline(userId) {
  return clients.has(String(userId));
}

function onlineUserIds() {
  return [...clients.keys()];
}

/** Sends an event to every open tab of this user. */
function publish(userId, event, data) {
  const set = clients.get(String(userId));
  if (!set) return;
  for (const client of set) {
    try {
      write(client, event, data);
    } catch {
      removeClient(client);
    }
  }
}

async function unreadCount(conn, userId) {
  const [[{ unread }]] = await (conn || db).query(
    "SELECT COUNT(*) AS unread FROM notifications WHERE user_id = ? AND is_read = 0",
    [userId]
  );
  return Number(unread);
}

/** Pushes the user's current unread count (after read / read-all / delete, so other tabs stay in sync). */
async function publishUnread(userId) {
  if (!isOnline(userId)) return;
  publish(userId, "unread", { unread: await unreadCount(null, userId) });
}

module.exports = {
  issueTicket,
  redeemTicket,
  sessionIsValid,
  openStream,
  isOnline,
  onlineUserIds,
  publish,
  publishUnread,
  unreadCount
};
