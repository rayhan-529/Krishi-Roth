/** Emoji shown next to each notification type (bell dropdown and the notifications page). */
export const NOTIFICATION_ICONS = {
  offer_new: '📩', offer_accepted: '✅', offer_rejected: '❌', booking_new: '📥', booking_status: '📅', harvest_reminder: '⏰',
  market_price: '📊', trade_update: '🤝', announcement: '📢', verification: '🛡️', message: '💬', review: '⭐', weather_alert: '⚠️',
}

export const notificationIcon = (type) => NOTIFICATION_ICONS[type] || '🔔'
