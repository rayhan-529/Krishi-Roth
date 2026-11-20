/** Simple line icons (24x24, drawn with the current text colour). */
const PATHS = {
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  bell: (<><path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 8 2.5 8h-17S6 15 6 9z" /><path d="M10 20a2 2 0 0 0 4 0" /></>),
  user: (<><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></>),
  users: (<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.2c2 .7 3.5 2.8 3.5 5.8" /></>),
  search: (<><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></>),
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  checkCircle: (<><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.7 2.7L16 9.5" /></>),
  xCircle: (<><circle cx="12" cy="12" r="9" /><path d="M9 9l6 6M15 9l-6 6" /></>),
  chevronRight: <path d="M9 6l6 6-6 6" />,
  chevronLeft: <path d="M15 6l-6 6 6 6" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  logout: (<><path d="M15 4h4v16h-4" /><path d="M10 8l-4 4 4 4M6 12h10" /></>),
  globe: (<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" /></>),
  message: <path d="M4 5h16v11H9l-5 4z" />,
  star: <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" />,
  trash: (<><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></>),
  edit: (<><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13 7l4 4" /></>),
  eye: (<><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>),
  eyeOff: (<><path d="M3 3l18 18" /><path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 4.9-1.3" /></>),
  send: <path d="M4 12l16-8-6 16-2.5-6.5z" />,
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z" />,
  mail: (<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>),
  pin: (<><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z" /><circle cx="12" cy="9" r="2.5" /></>),
  calendar: (<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>),
  clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  upload: (<><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v4h16v-4" /></>),
  inbox: (<><path d="M3 13l3-8h12l3 8v6H3z" /><path d="M3 13h5l1 3h6l1-3h5" /></>),
  image: (<><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 17l-5-5-9 8" /></>),
  leaf: (<><path d="M5 19C5 10 11 4 20 4c0 9-6 15-15 15z" /><path d="M5 19l8-8" /></>),
  sprout: (<><path d="M12 21v-9" /><path d="M12 12C12 8 9 6 4 6c0 4 3 6 8 6zM12 10c0-3.5 2.5-6 8-6 0 4-3 6-8 6z" /></>),
  wheat: (<><path d="M12 22V8" /><path d="M12 8c-2-1-3-3-3-5 2 1 3 3 3 5zM12 8c2-1 3-3 3-5-2 1-3 3-3 5zM12 13c-2.5-.5-4-2.5-4.5-4.5 2.5.5 4 2.5 4.5 4.5zM12 13c2.5-.5 4-2.5 4.5-4.5-2.5.5-4 2.5-4.5 4.5zM12 18c-2.5-.5-4-2.5-4.5-4.5 2.5.5 4 2.5 4.5 4.5zM12 18c2.5-.5 4-2.5 4.5-4.5-2.5.5-4 2.5-4.5 4.5z" /></>),
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  trend: (<><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></>),
  grid: (<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>),
  home: (<><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></>),
  store: (<><path d="M4 9l1.5-5h13L20 9" /><path d="M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0" /><path d="M5 11v9h14v-9M10 20v-5h4v5" /></>),
  cart: (<><path d="M3 4h2l2.5 11h11L21 7H6.2" /><circle cx="9" cy="19.5" r="1.5" /><circle cx="17" cy="19.5" r="1.5" /></>),
  tag: (<><path d="M3 12V4h8l10 10-8 8z" /><circle cx="7.5" cy="8.5" r="1.5" /></>),
  handshake: (<><path d="M2 12l4-4 4 2 3-2 3 1 6 4" /><path d="M6 8v6l5 5 2-2M13 17l2 2 2-2M15 15l2 2 3-3M10 10l3 3" /></>),
  truck: (<><path d="M2 6h12v10H2zM14 10h4l3 3v3h-7" /><circle cx="6" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></>),
  tractor: (<><circle cx="7" cy="16" r="4" /><circle cx="18" cy="18" r="2" /><path d="M7 12V6h6l2 6h4v4M11 12h4" /><path d="M13 6V4" /></>),
  wrench: <path d="M14.5 6.5a4 4 0 0 0 5.2 5.2L21 13l-8 8-3-3 8-8-1.3-1.3a4 4 0 0 1-5.2-5.2l2.5 2.5 2-2z" />,
  book: (<><path d="M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z" /><path d="M4 17a3 3 0 0 1 3-3h11M8 8h6" /></>),
  calculator: (<><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" /></>),
  clipboard: (<><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1M9 10h6M9 14h6" /></>),
  file: (<><path d="M6 3h8l5 5v13H6z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>),
  printer: (<><path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M7 14h10v7H7z" /></>),
  megaphone: (<><path d="M3 10v4h4l8 5V5L7 10z" /><path d="M18 9a4 4 0 0 1 0 6" /></>),
  bot: (<><rect x="4" y="8" width="16" height="12" rx="3" /><path d="M12 8V4M9 13h.01M15 13h.01M9 17h6" /></>),
  mic: (<><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>),
  stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
  sparkle: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z" />,
  compass: (<><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></>),
  wallet: (<><path d="M4 6h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4z" /><path d="M4 6l11-3v3M15 13h5" /></>),
  alert: (<><path d="M12 3l10 17H2z" /><path d="M12 10v4M12 17v.5" /></>),
  shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
  refresh: (<><path d="M20 11a8 8 0 0 0-14.9-3M4 4v4h4" /><path d="M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4" /></>),
  filter: <path d="M4 5h16l-6 7v6l-4 2v-8z" />,
  info: (<><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></>),
  // weather
  sun: (<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>),
  partly: (<><path d="M8 3v1.5M3.5 8H2M4.2 4.2l1 1M12.5 4.8l-1 1" /><path d="M5.5 10.5A3.5 3.5 0 0 1 11.6 7" /><path d="M8 19h9a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.6A3.2 3.2 0 0 0 8 19z" /></>),
  cloud: <path d="M7 19h10a4.5 4.5 0 0 0 .6-9A6 6 0 0 0 6 11.2 4 4 0 0 0 7 19z" />,
  fog: (<><path d="M7 14h10a4 4 0 0 0 .5-8A5.5 5.5 0 0 0 7 7.5 3.5 3.5 0 0 0 7 14z" /><path d="M4 18h16M7 21h10" /></>),
  drizzle: (<><path d="M7 14h10a4 4 0 0 0 .5-8A5.5 5.5 0 0 0 7 7.5 3.5 3.5 0 0 0 7 14z" /><path d="M9 17v1M13 18v1M16 17v1" /></>),
  rain: (<><path d="M7 14h10a4 4 0 0 0 .5-8A5.5 5.5 0 0 0 7 7.5 3.5 3.5 0 0 0 7 14z" /><path d="M9 17l-1 3M13 17l-1 3M17 17l-1 3" /></>),
  'heavy-rain': (<><path d="M7 13h10a4 4 0 0 0 .5-8A5.5 5.5 0 0 0 7 6.5 3.5 3.5 0 0 0 7 13z" /><path d="M8 16l-1.5 4M12 16l-1.5 4M16 16l-1.5 4M10 15.5l-.5 1.5M14 15.5l-.5 1.5" /></>),
  storm: (<><path d="M7 13h10a4 4 0 0 0 .5-8A5.5 5.5 0 0 0 7 6.5 3.5 3.5 0 0 0 7 13z" /><path d="M12.5 14l-2.5 4h3l-2 4" /></>),
  snow: (<><path d="M7 13h10a4 4 0 0 0 .5-8A5.5 5.5 0 0 0 7 6.5 3.5 3.5 0 0 0 7 13z" /><path d="M9 17h.01M13 17h.01M11 20h.01M15 20h.01" /></>),
  droplet: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
  wind: <path d="M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7" />,
  thermometer: (<><path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z" /><path d="M12 9v7" /></>),
}

/** Old emoji markers mapped to line icons, so every page renders consistently. */
const EMOJI = {
  '🌾': 'wheat', '📊': 'trend', '🚜': 'tractor', '🚚': 'truck', '👨‍🌾': 'users', '🤝': 'handshake',
  '🌱': 'sprout', '⭐': 'star', '🧮': 'calculator', '📅': 'calendar', '🗓️': 'calendar', '📒': 'book',
  '📩': 'inbox', '📥': 'inbox', '📨': 'mail', '✉️': 'mail', '🛒': 'cart', '🛡️': 'shield', '✅': 'checkCircle',
  '❌': 'xCircle', '🤖': 'bot', '💬': 'message', '📢': 'megaphone', '👥': 'users', '🖨️': 'printer',
  '🧑‍🔧': 'wrench', '📞': 'phone', '🔔': 'bell', '⚠️': 'alert', '➕': 'plus', '✍️': 'edit', '🧭': 'compass', '⏰': 'clock',
}

export default function Icon({ name, size = 20, className = '', title }) {
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      {PATHS[name] || PATHS.info}
    </svg>
  )
}

/** Renders an icon from either an icon name or a legacy emoji marker. */
export function Glyph({ value, size = 20 }) {
  if (!value) return null
  if (typeof value !== 'string') return value
  const name = PATHS[value] ? value : EMOJI[value]
  return name ? <Icon name={name} size={size} /> : <span>{value}</span>
}
