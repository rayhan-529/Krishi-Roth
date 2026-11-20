/**
 * Where each role lands after login and which links its menu shows.
 * Each link: [path, bengali, english]
 */
export const HOME_BY_ROLE = {
  farmer: '/farmer',
  buyer: '/buyer',
  labour: '/provider',
  harvester_owner: '/provider',
  tractor_owner: '/provider',
  transport_owner: '/provider',
  admin: '/admin',
}

export const PROVIDER_ROLES = ['labour', 'harvester_owner', 'tractor_owner', 'transport_owner']

const PUBLIC = [
  ['/market-prices', 'বাজারদর', 'Market Prices'],
  ['/weather', 'আবহাওয়া', 'Weather'],
  ['/marketplace', 'ফসলের বাজার', 'Marketplace'],
  ['/services/labour', 'শ্রমিক', 'Labour'],
  ['/services/harvester', 'হারভেস্টার', 'Harvester'],
  ['/services/tractor', 'ট্রাক্টর', 'Tractor'],
  ['/services/transport', 'পরিবহন', 'Transport'],
  ['/chatbot', 'এআই সহায়ক', 'AI Assistant'],
]

export const MENUS = {
  guest: [['/', 'হোম', 'Home'], ...PUBLIC, ['/about', 'আমাদের সম্পর্কে', 'About']],
  farmer: [
    ['/farmer', 'ড্যাশবোর্ড', 'Dashboard'],
    ['/farmer/listings', 'আমার ফসল', 'My Crops'],
    ['/offers', 'ক্রয় প্রস্তাব', 'Offers'],
    ['/trades', 'লেনদেন', 'Transactions'],
    ['/wallet', 'ওয়ালেট', 'Wallet'],
    ['/farmer/harvests', 'ফসল ব্যবস্থাপনা', 'Harvests'],
    ['/farmer/notebooks', 'খরচের খাতা', 'Expense Notebook'],
    ['/bookings', 'বুকিং', 'Bookings'],
    ['/messages', 'বার্তা', 'Messages'],
    ...PUBLIC,
  ],
  buyer: [
    ['/buyer', 'ড্যাশবোর্ড', 'Dashboard'],
    ['/marketplace', 'ফসলের বাজার', 'Marketplace'],
    ['/offers', 'আমার প্রস্তাব', 'My Offers'],
    ['/trades', 'লেনদেন', 'Transactions'],
    ['/wallet', 'ওয়ালেট', 'Wallet'],
    ['/messages', 'বার্তা', 'Messages'],
    ['/market-prices', 'বাজারদর', 'Market Prices'],
    ['/services/transport', 'পরিবহন', 'Transport'],
    ['/bookings', 'বুকিং', 'Bookings'],
    ['/chatbot', 'এআই সহায়ক', 'AI Assistant'],
  ],
  provider: [
    ['/provider', 'ড্যাশবোর্ড', 'Dashboard'],
    ['/provider/services', 'আমার সেবা', 'My Services'],
    ['/bookings', 'বুকিং অনুরোধ', 'Bookings'],
    ['/market-prices', 'বাজারদর', 'Market Prices'],
    ['/chatbot', 'এআই সহায়ক', 'AI Assistant'],
  ],
  admin: [
    ['/admin', 'ড্যাশবোর্ড', 'Dashboard'],
    ['/admin/users', 'ব্যবহারকারী', 'Users'],
    ['/admin/verifications', 'যাচাই', 'Verifications'],
    ['/admin/crops', 'ফসল ও বিজ্ঞাপন', 'Crops & Listings'],
    ['/admin/market-prices', 'বাজারদর', 'Market Prices'],
    ['/admin/trades', 'লেনদেন', 'Transactions'],
    ['/admin/wallet', 'ওয়ালেট ও সেফ ট্রেড', 'Wallet & Safe Trade'],
    ['/admin/bookings', 'বুকিং', 'Bookings'],
    ['/admin/complaints', 'অভিযোগ', 'Complaints'],
    ['/admin/reviews', 'রিভিউ', 'Reviews'],
    ['/admin/announcements', 'ঘোষণা', 'Announcements'],
    ['/admin/reports', 'রিপোর্ট', 'Reports'],
  ],
}

export function menuFor(user) {
  if (!user) return MENUS.guest
  if (user.role === 'admin') return MENUS.admin
  if (PROVIDER_ROLES.includes(user.role)) return MENUS.provider
  return MENUS[user.role] || MENUS.guest
}

/** Sidebar icon for each menu path (see components/Icon.jsx). */
export const NAV_ICON = {
  '/': 'home',
  '/farmer': 'grid',
  '/buyer': 'grid',
  '/provider': 'grid',
  '/admin': 'grid',
  '/farmer/listings': 'tag',
  '/offers': 'inbox',
  '/trades': 'handshake',
  '/wallet': 'wallet',
  '/admin/wallet': 'wallet',
  '/farmer/harvests': 'sprout',
  '/farmer/notebooks': 'book',
  '/bookings': 'calendar',
  '/messages': 'message',
  '/market-prices': 'trend',
  '/weather': 'partly',
  '/marketplace': 'store',
  '/services/labour': 'users',
  '/services/harvester': 'wheat',
  '/services/tractor': 'tractor',
  '/services/transport': 'truck',
  '/chatbot': 'sparkle',
  '/about': 'info',
  '/provider/services': 'wrench',
  '/admin/users': 'users',
  '/admin/verifications': 'shield',
  '/admin/crops': 'wheat',
  '/admin/market-prices': 'trend',
  '/admin/trades': 'handshake',
  '/admin/bookings': 'calendar',
  '/admin/complaints': 'alert',
  '/admin/reviews': 'star',
  '/admin/announcements': 'megaphone',
  '/admin/reports': 'file',
}

/** Short top-bar links for visitors; the rest stay in the drawer. */
export const GUEST_TOP = ['/market-prices', '/marketplace', '/services/labour', '/services/transport', '/chatbot']
