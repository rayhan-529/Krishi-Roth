/**
 * Bengali and English names for every fixed value the API uses.
 *   label('unit', 'maund', lang)  ->  'মণ' | 'maund'
 */
const L = {
  unit: {
    kg: ['কেজি', 'kg'], maund: ['মণ', 'maund'], ton: ['টন', 'ton'], piece: ['পিস', 'piece'], dozen: ['ডজন', 'dozen'],
    hali: ['হালি', 'hali'], bundle: ['আঁটি', 'bundle'], crate: ['ক্রেট', 'crate'],
  },
  landUnit: {
    decimal: ['শতাংশ', 'decimal'], katha: ['কাঠা', 'katha'], bigha: ['বিঘা', 'bigha'], acre: ['একর', 'acre'], hectare: ['হেক্টর', 'hectare'],
  },
  role: {
    farmer: ['কৃষক', 'Farmer'], buyer: ['ক্রেতা', 'Buyer'], labour: ['কৃষি শ্রমিক', 'Labour'],
    harvester_owner: ['হারভেস্টার মালিক', 'Harvester Owner'], tractor_owner: ['ট্রাক্টর মালিক', 'Tractor Owner'],
    transport_owner: ['পরিবহন মালিক', 'Transport Owner'], admin: ['অ্যাডমিন', 'Admin'],
  },
  listingStatus: {
    active: ['বিক্রির জন্য আছে', 'Active'], reserved: ['সংরক্ষিত', 'Reserved'], sold: ['বিক্রি হয়েছে', 'Sold'],
    expired: ['মেয়াদ শেষ', 'Expired'], removed: ['সরানো হয়েছে', 'Removed'],
  },
  offerStatus: {
    pending: ['অপেক্ষমাণ', 'Pending'], accepted: ['গৃহীত', 'Accepted'], rejected: ['প্রত্যাখ্যাত', 'Rejected'],
    withdrawn: ['প্রত্যাহার করা', 'Withdrawn'], expired: ['মেয়াদ শেষ', 'Expired'],
  },
  tradeStatus: {
    payment_pending: ['মূল্য পরিশোধ বাকি', 'Payment Pending'], payment_confirmed: ['টাকা সেফ ট্রেডে জমা', 'Paid into escrow'],
    delivery_pending: ['ডেলিভারি চলছে', 'Delivery Pending'], completed: ['সম্পন্ন', 'Completed'],
    cancelled: ['বাতিল', 'Cancelled'], disputed: ['অভিযোগ চলছে', 'Disputed'],
  },
  bookingStatus: {
    pending: ['অপেক্ষমাণ', 'Pending'], accepted: ['গৃহীত', 'Accepted'], rejected: ['প্রত্যাখ্যাত', 'Rejected'],
    cancelled: ['বাতিল', 'Cancelled'], in_progress: ['কাজ চলছে', 'In Progress'], completed: ['সম্পন্ন', 'Completed'],
  },
  bookingType: {
    labour: ['শ্রমিক', 'Labour'], harvester: ['হারভেস্টার', 'Harvester'], tractor: ['ট্রাক্টর', 'Tractor'], transport: ['পরিবহন', 'Transport'],
  },
  harvestStatus: {
    planned: ['পরিকল্পিত', 'Planned'], growing: ['বাড়ছে', 'Growing'], ready: ['কাটার উপযোগী', 'Ready to Harvest'],
    harvesting: ['কাটা চলছে', 'Harvesting'], completed: ['সম্পন্ন', 'Completed'],
  },
  verification: {
    unverified: ['যাচাই হয়নি', 'Not verified'], pending: ['যাচাই চলছে', 'Pending'], verified: ['যাচাইকৃত', 'Verified'],
    rejected: ['যাচাই বাতিল', 'Rejected'], approved: ['অনুমোদিত', 'Approved'],
  },
  complaintStatus: {
    open: ['খোলা', 'Open'], in_review: ['দেখা হচ্ছে', 'In review'], resolved: ['সমাধান হয়েছে', 'Resolved'], dismissed: ['বাতিল', 'Dismissed'],
  },
  complaintCategory: {
    fraud: ['প্রতারণা', 'Fraud'], payment: ['মূল্য পরিশোধ', 'Payment'], delivery: ['ডেলিভারি', 'Delivery'], quality: ['মান', 'Quality'],
    behaviour: ['আচরণ', 'Behaviour'], service: ['সেবা', 'Service'], technical: ['কারিগরি সমস্যা', 'Technical'], other: ['অন্যান্য', 'Other'],
  },
  machinePrice: {
    per_hour: ['প্রতি ঘণ্টা', 'per hour'], per_day: ['প্রতি দিন', 'per day'], per_acre: ['প্রতি একর', 'per acre'],
    per_bigha: ['প্রতি বিঘা', 'per bigha'], per_decimal: ['প্রতি শতাংশ', 'per decimal'],
    per_km: ['প্রতি কিমি', 'per km'], per_trip: ['প্রতি ট্রিপ', 'per trip'], per_ton: ['প্রতি টন', 'per ton'],
  },
  vehicleType: {
    truck: ['ট্রাক', 'Truck'], mini_truck: ['মিনি ট্রাক', 'Mini truck'], pickup: ['পিকআপ', 'Pickup'], covered_van: ['কাভার্ড ভ্যান', 'Covered van'],
    van: ['ভ্যান', 'Van'], trolley: ['ট্রলি', 'Trolley'], nosimon: ['নসিমন/করিমন', 'Nosimon'], boat: ['নৌকা', 'Boat'], other: ['অন্যান্য', 'Other'],
  },
  paymentMethod: {
    cash: ['নগদ', 'Cash'], bkash: ['বিকাশ', 'bKash'], nagad: ['নগদ (মোবাইল)', 'Nagad'], rocket: ['রকেট', 'Rocket'],
    bank_transfer: ['ব্যাংক ট্রান্সফার', 'Bank transfer'], other: ['অন্যান্য', 'Other'],
    wallet: ['কৃষি রথ ওয়ালেট (সেফ ট্রেড)', 'Krishi Roth wallet (Safe Trade)'],
  },
  walletMethod: { bkash: ['বিকাশ', 'bKash'], nagad: ['নগদ', 'Nagad'], rocket: ['রকেট', 'Rocket'] },
  escrowStatus: {
    none: ['সেফ ট্রেড নয়', 'No escrow'], held: ['টাকা নিরাপদে জমা', 'Held in escrow'],
    released: ['কৃষককে দেওয়া হয়েছে', 'Released to farmer'], refunded: ['ক্রেতাকে ফেরত', 'Refunded to buyer'],
  },
  walletTx: {
    deposit: ['ব্যালেন্স যোগ', 'Balance added'], withdrawal: ['টাকা তোলা', 'Withdrawal'],
    withdrawal_refund: ['তোলা বাতিল, ফেরত', 'Withdrawal returned'], escrow_hold: ['সেফ ট্রেডে জমা', 'Paid into escrow'],
    escrow_release: ['কৃষককে পরিশোধ', 'Paid to farmer'], escrow_receive: ['বিক্রির টাকা পেয়েছেন', 'Sale received'],
    escrow_refund: ['সেফ ট্রেড ফেরত', 'Escrow refund'], adjustment: ['সমন্বয়', 'Adjustment'],
  },
  depositStatus: { pending: ['যাচাই চলছে', 'Checking'], approved: ['যোগ হয়েছে', 'Added'], rejected: ['বাতিল', 'Rejected'] },
  withdrawalStatus: { pending: ['অপেক্ষমাণ', 'Pending'], paid: ['পাঠানো হয়েছে', 'Sent'], rejected: ['বাতিল', 'Rejected'] },
  deliveryMethod: {
    buyer_pickup: ['ক্রেতা নিজে নেবেন', 'Buyer pickup'], farmer_delivery: ['কৃষক পৌঁছে দেবেন', 'Farmer delivers'],
    transport_service: ['পরিবহন সেবা', 'Transport service'],
  },
  season: {
    rabi: ['রবি', 'Rabi'], kharif_1: ['খরিফ-1', 'Kharif-1'], kharif_2: ['খরিফ-2', 'Kharif-2'], boro: ['বোরো', 'Boro'],
    aus: ['আউশ', 'Aus'], aman: ['আমন', 'Aman'], year_round: ['সারা বছর', 'Year round'],
  },
  documentType: {
    nid: ['জাতীয় পরিচয়পত্র (NID)', 'National ID (NID)'], birth_certificate: ['জন্ম নিবন্ধন', 'Birth certificate'],
    trade_license: ['ট্রেড লাইসেন্স', 'Trade licence'], driving_license: ['ড্রাইভিং লাইসেন্স', 'Driving licence'],
    vehicle_registration: ['গাড়ির রেজিস্ট্রেশন', 'Vehicle registration'], other: ['অন্যান্য', 'Other'],
  },
}

export const OPTIONS = Object.fromEntries(Object.entries(L).map(([group, values]) => [group, Object.keys(values)]))

export function label(group, value, lang) {
  if (value === null || value === undefined || value === '') return ''
  const entry = L[group] && L[group][value]
  if (!entry) return String(value)
  return lang === 'en' ? entry[1] : entry[0]
}

/** Options for a <select>: [{ value, label }] */
export function options(group, lang, only) {
  return (only || OPTIONS[group]).map((value) => ({ value, label: label(group, value, lang) }))
}

/** Colour family for status badges. */
export function statusTone(status) {
  if (['active', 'accepted', 'completed', 'verified', 'approved', 'resolved', 'payment_confirmed', 'ready', 'released', 'paid', 'held'].includes(status)) return 'green'
  if (['pending', 'payment_pending', 'in_review', 'planned', 'reserved', 'delivery_pending', 'in_progress', 'harvesting', 'growing', 'open'].includes(status)) return 'amber'
  if (['rejected', 'cancelled', 'disputed', 'removed', 'blocked', 'fraud'].includes(status)) return 'red'
  return 'grey'
}
