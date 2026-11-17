/**
 * Harvest reminders.
 *
 * A farmer gets one notification when a harvest is expected within the next
 * REMINDER_DAYS days. The check runs:
 *   - every few hours while the server is running (startScheduler), and
 *   - whenever a farmer opens their dashboard or harvest page, because free
 *     hosting plans put the server to sleep when nobody is using it.
 */
const db = require("../config/db");
const { notify } = require("./notificationService");
const { deleteOldSessions } = require("./tokenService");

const REMINDER_DAYS = 3;
const CHECK_EVERY_MS = 3 * 60 * 60 * 1000; // 3 hours

/**
 * Sends due reminders.
 * @param {number|null} farmerId  only this farmer, or everyone when null
 * @returns {Promise<number>} how many reminders were sent
 */
async function sendHarvestReminders(farmerId = null) {
  const [due] = await db.query(
    `SELECT h.id, h.farmer_id, h.expected_harvest_date, c.name_bn, c.name_en,
            DATEDIFF(h.expected_harvest_date, CURDATE()) AS days_left
     FROM harvests h JOIN crops c ON c.id = h.crop_id
     WHERE h.status IN ('planned','growing','ready')
       AND h.reminder_sent_at IS NULL
       AND h.expected_harvest_date IS NOT NULL
       AND h.expected_harvest_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)
       ${farmerId ? "AND h.farmer_id = ?" : ""}`,
    farmerId ? [REMINDER_DAYS, farmerId] : [REMINDER_DAYS]
  );

  for (const harvest of due) {
    // Mark first so two parallel checks cannot send the same reminder twice.
    const [result] = await db.query(
      "UPDATE harvests SET reminder_sent_at = NOW() WHERE id = ? AND reminder_sent_at IS NULL",
      [harvest.id]
    );
    if (result.affectedRows === 0) continue;

    const days = Number(harvest.days_left);
    await notify(null, harvest.farmer_id, {
      type: "harvest_reminder",
      title: [
        days === 0 ? `আজ ${harvest.name_bn} কাটার দিন` : `${days} দিন পর ${harvest.name_bn} কাটার সময়`,
        days === 0 ? `${harvest.name_en} harvest is due today` : `${harvest.name_en} harvest is due in ${days} day(s)`
      ],
      body: [
        `প্রত্যাশিত তারিখ: ${harvest.expected_harvest_date}। শ্রমিক ও হারভেস্টার আগে থেকে ঠিক করে রাখুন।`,
        `Expected date: ${harvest.expected_harvest_date}. Book labour and a harvester in advance.`
      ],
      link: "/farmer/harvests",
      entityType: "harvest",
      entityId: harvest.id
    });
  }

  return due.length;
}

let timer = null;

/** Starts the periodic background checks (called once from server.js). */
function startScheduler() {
  if (timer) return;

  const run = async () => {
    try {
      const sent = await sendHarvestReminders();
      if (sent > 0) console.log(`Harvest reminders sent: ${sent}`);
      await deleteOldSessions();
      // Required lazily: escrowService -> tradeService -> notificationService, loaded after start-up.
      const released = await require("./escrowService").releaseDueEscrows();
      if (released > 0) console.log(`Safe Trade escrows auto-released: ${released}`);
    } catch (error) {
      console.error("Scheduled task failed:", error.message);
    }
  };

  setTimeout(run, 30 * 1000).unref();
  timer = setInterval(run, CHECK_EVERY_MS);
  timer.unref();
}

module.exports = { sendHarvestReminders, startScheduler, REMINDER_DAYS };
