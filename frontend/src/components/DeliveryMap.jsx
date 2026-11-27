/**
 * Delivery map on the trade page.
 *
 * - The farmer marks where the crop is picked up, the buyer marks where it
 *   should go. Both see both points.
 * - Once the delivery starts, whoever brings the vehicle (the buyer for
 *   "buyer pickup", otherwise the farmer) shares the phone's live location.
 *   The other person sees the vehicle move, the distance left and an
 *   estimated arrival time. Updates arrive over the live notification stream.
 *
 * Map: Leaflet + OpenStreetMap tiles (free, no API key).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useLang } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import { useNotifications } from '../context/NotificationContext'
import { del, patch, post } from '../services/api'
import { num, timeAgo } from '../utils/format'
import { Alert, Card } from './ui'
import Icon from './Icon'

const BD_CENTER = [23.75, 90.35]
const SEND_EVERY_MS = 8000 // phone sends at most this often while moving...
const HEARTBEAT_MS = 30000 // ...and at least this often while standing still
const STALE_MS = 2 * 60 * 1000
const ROAD_FACTOR = 1.3 // roads are longer than a straight line
const DEFAULT_KMH = 25 // rural roads with a loaded vehicle

const MAP_FIELDS = ['status', 'delivery_method', 'tracker_id', 'pickup_lat', 'pickup_lng', 'drop_lat', 'drop_lng', 'tracking_active', 'tracking_by', 'vehicle_info', 'live_lat', 'live_lng', 'live_accuracy', 'live_speed', 'live_heading', 'live_updated_at']
const pickMap = (t) => Object.fromEntries(MAP_FIELDS.map((k) => [k, t[k] ?? null]))
const point = (lat, lng) => (lat != null && lng != null ? [Number(lat), Number(lng)] : null)

/** Straight-line distance in km. */
function distanceKm(a, b) {
  const rad = (d) => (d * Math.PI) / 180
  const dLat = rad(b[0] - a[0])
  const dLng = rad(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(h))
}

/** MySQL "YYYY-MM-DD HH:MM:SS" in Bangladesh time -> milliseconds. */
const bdTime = (value) => (value ? new Date(`${String(value).replace(' ', 'T')}+06:00`).getTime() : 0)

const pin = (emoji, cls) =>
  L.divIcon({ className: '', html: `<span class="map-pin ${cls}">${emoji}</span>`, iconSize: [38, 38], iconAnchor: [19, 36] })
const ICONS = { pickup: pin('🌾', 'pin-pickup'), drop: pin('🏠', 'pin-drop'), vehicle: pin('🚚', 'pin-vehicle') }

// ---------------------------------------------------------------- Leaflet map
function fitTo(m, pts) {
  if (!pts.length || !m.getSize().x) return
  if (pts.length === 1) m.setView(pts[0], 14)
  else m.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 15 })
}

function LeafletMap({ pickup, drop, vehicle, accuracy, placing, onPick, labels }) {
  const box = useRef(null)
  const map = useRef(null)
  const layers = useRef({})
  const fittedKey = useRef('')
  const userMoved = useRef(false)
  const points = useRef([])
  const pickRef = useRef(onPick)

  useEffect(() => {
    pickRef.current = onPick
  }, [onPick])

  useEffect(() => {
    const m = L.map(box.current, { zoomControl: true, attributionControl: true }).setView(BD_CENTER, 7)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m)
    m.on('click', (e) => pickRef.current && pickRef.current([e.latlng.lat, e.latlng.lng]))
    m.on('dragstart', () => (userMoved.current = true))
    box.current.addEventListener('wheel', () => (userMoved.current = true), { passive: true })
    map.current = m
    // The card may still be getting its size when the map is created: fit again once it has one.
    const resize = new ResizeObserver(() => {
      m.invalidateSize()
      if (!userMoved.current) fitTo(m, points.current)
    })
    resize.observe(box.current)
    return () => {
      resize.disconnect()
      m.remove()
      map.current = null
      layers.current = {}
    }
  }, [])

  // Markers and lines follow the props.
  useEffect(() => {
    const m = map.current
    if (!m) return
    const set = (key, latlng, make) => {
      const layer = layers.current[key]
      if (!latlng) {
        if (layer) m.removeLayer(layer)
        delete layers.current[key]
        return
      }
      if (layer) {
        if (layer.setLatLng) layer.setLatLng(latlng)
        else layer.setLatLngs(latlng)
      } else {
        layers.current[key] = make(latlng).addTo(m)
      }
    }
    set('pickup', pickup, (p) => L.marker(p, { icon: ICONS.pickup, title: labels.pickup }).bindTooltip(labels.pickup))
    set('drop', drop, (p) => L.marker(p, { icon: ICONS.drop, title: labels.drop }).bindTooltip(labels.drop))
    set('route', pickup && drop ? [pickup, drop] : null, (p) => L.polyline(p, { color: '#15803d', weight: 3, dashArray: '6 8', opacity: 0.8 }))
    set('vehicle', vehicle, (p) => L.marker(p, { icon: ICONS.vehicle, zIndexOffset: 1000, title: labels.vehicle }).bindTooltip(labels.vehicle))
    set('accuracy', vehicle && accuracy > 30 ? vehicle : null, (p) => L.circle(p, { radius: accuracy, color: '#f59e0b', weight: 1, fillOpacity: 0.08 }))
    if (layers.current.accuracy && accuracy) layers.current.accuracy.setRadius(accuracy)

    // Zoom to fit only when a point appears or disappears, not on every vehicle move.
    points.current = [pickup, drop, vehicle].filter(Boolean)
    const key = [pickup, drop, vehicle].map((p) => (p ? 1 : 0)).join('')
    if (points.current.length && key !== fittedKey.current) {
      fittedKey.current = key
      fitTo(m, points.current)
    }
  }, [pickup, drop, vehicle, accuracy, labels])

  const fitAll = () => {
    userMoved.current = false
    if (map.current) fitTo(map.current, points.current)
  }

  return (
    <div className={`delivery-map ${placing ? 'placing' : ''}`}>
      <div ref={box} className="delivery-map-canvas" />
      <button type="button" className="map-fit-btn" onClick={fitAll} aria-label={labels.fit} title={labels.fit}>
        <Icon name="compass" size={18} />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------- live sharing (sender)
const isMobile = () => /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)

function geoError(error, tr) {
  if (!error) return null
  if (error === 'unsupported') return tr('এই ব্রাউজারে লোকেশন পাওয়া যায় না।', 'This browser cannot share location.')
  if (error === 'insecure') return tr('লোকেশন শুধু https বা localhost ঠিকানায় কাজ করে। সাইটটি https:// দিয়ে খুলুন।', 'Location only works on https or localhost. Open the site with https://.')
  if (error.code === 1) return tr('লোকেশনের অনুমতি দেওয়া হয়নি। ঠিকানার বারের বাম পাশের আইকনে ক্লিক করে এই সাইটকে Location-এর অনুমতি দিন।', 'Location permission was denied. Click the icon left of the address bar and allow Location for this site.')
  // 2 = position unavailable, 3 = timeout
  return isMobile()
    ? tr('লোকেশন পাওয়া যাচ্ছে না। ফোনের Location/GPS চালু করে খোলা জায়গায় আবার চেষ্টা করুন, অথবা ম্যাপে ক্লিক করে জায়গা বেছে নিন।', 'Location is not available. Turn on Location/GPS and try again in an open place, or pick the place on the map.')
    : tr('কম্পিউটার আপনার অবস্থান বের করতে পারছে না। Mac-এ: System Settings → Privacy & Security → Location Services চালু করুন এবং তালিকায় Google Chrome-এ টিক দিন। Wi-Fi চালু রাখুন (সংযোগ না থাকলেও চলবে)। তারপর Chrome পুরো বন্ধ করে আবার খুলুন। এখনই কাজ চালাতে ম্যাপে ক্লিক করে জায়গা বেছে নিন।', 'Your computer cannot find its location. On a Mac: System Settings → Privacy & Security → Location Services, turn it on and tick Google Chrome. Keep Wi-Fi on. Then quit and reopen Chrome. For now, pick the place on the map.')
}

/**
 * One position. Asks for GPS-level accuracy first; computers (and phones
 * indoors) often fail that, so it falls back to a normal Wi-Fi/network fix.
 */
function locate() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject('unsupported')
    if (!window.isSecureContext) return reject('insecure')
    navigator.geolocation.getCurrentPosition(resolve, (first) => {
      if (first.code === 1) return reject(first)
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 20000, maximumAge: 10 * 60 * 1000 })
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 })
  })
}

function useLocationSharing(tradeId, onMap) {
  const [sharing, setSharing] = useState(false)
  const [lastSent, setLastSent] = useState(null)
  const [error, setError] = useState(null)
  const watch = useRef(null)
  const timer = useRef(null)
  const wakeLock = useRef(null)
  const last = useRef({ at: 0, pos: null, latest: null })
  const vehicleInfo = useRef(null)
  const onMapRef = useRef(onMap)

  useEffect(() => {
    onMapRef.current = onMap
  }, [onMap])

  const halt = useCallback(() => {
    if (watch.current != null) navigator.geolocation.clearWatch(watch.current)
    watch.current = null
    clearInterval(timer.current)
    if (wakeLock.current) wakeLock.current.release().catch(() => {})
    wakeLock.current = null
    setSharing(false)
  }, [])

  const send = useCallback(
    (pos, force = false) => {
      const now = Date.now()
      const here = [pos.coords.latitude, pos.coords.longitude]
      const moved = last.current.pos ? distanceKm(last.current.pos, here) * 1000 : Infinity
      if (!force && now - last.current.at < SEND_EVERY_MS && moved < 30) return
      last.current.at = now
      last.current.pos = here
      const body = {
        lat: here[0],
        lng: here[1],
        accuracy: pos.coords.accuracy,
        speed: pos.coords.speed != null && pos.coords.speed >= 0 ? pos.coords.speed : undefined,
        heading: pos.coords.heading != null && !Number.isNaN(pos.coords.heading) ? pos.coords.heading : undefined,
        vehicle_info: vehicleInfo.current || undefined,
      }
      vehicleInfo.current = null
      post(`/trades/${tradeId}/tracking`, body)
        .then((b) => {
          setLastSent(Date.now())
          if (b.data && !b.data.skipped) onMapRef.current(b.data)
        })
        .catch((err) => {
          // The trade moved on (delivered, cancelled): stop the GPS.
          if (err.status === 400 || err.status === 403 || err.status === 404) {
            halt()
            setError({ message: err.message })
          }
        })
    },
    [tradeId, halt],
  )

  const keepScreenOn = useCallback(async () => {
    try {
      if ('wakeLock' in navigator && document.visibilityState === 'visible') wakeLock.current = await navigator.wakeLock.request('screen')
    } catch {
      // not supported or refused: sharing still works while the screen is on
    }
  }, [])

  const start = useCallback(
    (info) => {
      if (!('geolocation' in navigator)) {
        setError('unsupported')
        return
      }
      if (!window.isSecureContext) {
        setError('insecure')
        return
      }
      if (watch.current != null) return
      setError(null)
      vehicleInfo.current = info || null
      last.current = { at: 0, pos: null, latest: null }
      watch.current = navigator.geolocation.watchPosition(
        (pos) => {
          setError(null)
          last.current.latest = pos
          send(pos)
        },
        (err) => {
          setError(err)
          if (err.code === 1) halt()
        },
        { enableHighAccuracy: isMobile(), maximumAge: 5000, timeout: 30000 },
      )
      // Standing still produces no GPS events; keep the other side's "last seen" fresh.
      timer.current = setInterval(() => last.current.latest && Date.now() - last.current.at >= HEARTBEAT_MS && send(last.current.latest, true), 5000)
      keepScreenOn()
      setSharing(true)
    },
    [send, halt, keepScreenOn],
  )

  const stop = useCallback(async () => {
    halt()
    const b = await del(`/trades/${tradeId}/tracking`)
    onMapRef.current(b.data)
    return b
  }, [tradeId, halt])

  // The wake lock is dropped when the tab is hidden; take it again on return.
  useEffect(() => {
    const again = () => sharing && !wakeLock.current && keepScreenOn()
    document.addEventListener('visibilitychange', again)
    return () => document.removeEventListener('visibilitychange', again)
  }, [sharing, keepScreenOn])

  // Leaving the page stops the GPS (the other side then sees "last seen").
  useEffect(() => halt, [halt])

  return { sharing, lastSent, error, start, stop }
}

// ---------------------------------------------------------------- the card
export default function DeliveryMap({ trade, userId, onStatusChange }) {
  const { lang, tr } = useLang()
  const toast = useToast()
  const live = useNotifications()
  const [m, setM] = useState(() => pickMap(trade))
  const [placing, setPlacing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [placeError, setPlaceError] = useState(null)
  const [vehicle, setVehicle] = useState('')
  const [, tick] = useState(0)
  const resumed = useRef(false)

  const isFarmer = userId === trade.farmer_id
  const isBuyer = userId === trade.buyer_id
  const closed = ['completed', 'cancelled'].includes(m.status)
  const onTheWay = m.status === 'delivery_pending'
  const isTracker = m.tracker_id != null && m.tracker_id === userId

  const applyMap = useCallback((data) => setM((cur) => ({ ...cur, ...pickMap(data) })), [])
  const sharing = useLocationSharing(trade.id, applyMap)

  // Page data reloaded (e.g. after an action) -> take the fresh map fields.
  useEffect(() => {
    setM(pickMap(trade))
  }, [trade])

  // Live updates from the other person (and status changes).
  useEffect(
    () =>
      live.onEvent('trade_map', (data) => {
        if (data.trade_id !== trade.id) return
        applyMap(data)
        if (data.status !== trade.status) onStatusChange()
      }),
    [live, trade.id, trade.status, applyMap, onStatusChange],
  )
  // After a reconnect, reload in case updates were missed.
  useEffect(() => live.onEvent('ready', () => onStatusChange()), [live, onStatusChange])

  // "Updated 20 seconds ago" keeps counting.
  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 15000)
    return () => clearInterval(timer)
  }, [])

  // The tracker reloaded the page while sharing: continue if location is already allowed.
  useEffect(() => {
    if (resumed.current || !isTracker || !onTheWay || !m.tracking_active || sharing.sharing) return
    resumed.current = true
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then((p) => p.state === 'granted' && sharing.start()).catch(() => {})
    }
  }, [isTracker, onTheWay, m.tracking_active, sharing])

  const pickup = point(m.pickup_lat, m.pickup_lng)
  const drop = point(m.drop_lat, m.drop_lng)
  const vehiclePos = m.tracking_active || (onTheWay && m.live_updated_at) ? point(m.live_lat, m.live_lng) : null
  const myKind = isFarmer ? 'pickup' : 'drop'
  const myPoint = isFarmer ? pickup : drop

  async function savePlace(latlng) {
    setSaving(true)
    try {
      const b = await patch(`/trades/${trade.id}/place`, { lat: latlng[0], lng: latlng[1] })
      applyMap(b.data)
      toast.success(b.message)
      setPlacing(false)
      setPlaceError(null)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function locateMe() {
    setSaving(true)
    setPlaceError(null)
    try {
      const pos = await locate()
      await savePlace([pos.coords.latitude, pos.coords.longitude])
    } catch (err) {
      setSaving(false)
      setPlaceError(err)
      // Let the person carry on by clicking on the map instead.
      if (err && err.code !== 1) setPlacing(true)
    }
  }

  // Distance and arrival estimate for the moving vehicle.
  const comingToFarm = m.delivery_method === 'buyer_pickup'
  const destination = comingToFarm ? pickup : drop
  let eta = null
  if (vehiclePos && destination) {
    const km = distanceKm(vehiclePos, destination) * ROAD_FACTOR
    const kmh = m.live_speed > 1.5 ? Math.max(10, m.live_speed * 3.6) : DEFAULT_KMH
    eta = { km, minutes: Math.max(1, Math.round((km / kmh) * 60)), arrived: km < 0.2 }
  }
  const lastSeen = bdTime(m.live_updated_at)
  const stale = vehiclePos && Date.now() - lastSeen > STALE_MS
  const tripKm = pickup && drop ? distanceKm(pickup, drop) * ROAD_FACTOR : null

  const labels = {
    pickup: tr('ফসল নেওয়ার জায়গা (কৃষক)', 'Pickup (farmer)'),
    drop: tr('ডেলিভারির জায়গা (ক্রেতা)', 'Delivery point (buyer)'),
    vehicle: tr('গাড়ি (লাইভ)', 'Vehicle (live)'),
    fit: tr('সব দেখুন', 'Show all'),
  }

  const directions = pickup && drop
    ? `https://www.google.com/maps/dir/?api=1&origin=${pickup.join(',')}&destination=${drop.join(',')}&travelmode=driving`
    : null
  const trackerName = m.tracker_id === trade.farmer_id ? trade.farmer_name : trade.buyer_name

  return (
    <Card
      title={tr('ম্যাপ ও ডেলিভারি', 'Map & delivery')}
      actions={vehiclePos && !stale && m.tracking_active ? <span className="live-badge"><span className="live-dot on" /> {tr('লাইভ', 'Live')}</span> : null}
    >
      <LeafletMap pickup={pickup} drop={drop} vehicle={vehiclePos} accuracy={m.live_accuracy} placing={placing} onPick={placing ? savePlace : null} labels={labels} />

      <ul className="map-legend">
        <li><span aria-hidden="true">🌾</span> {labels.pickup}: {pickup ? <strong>{tr('দেওয়া আছে', 'set')}</strong> : <span className="muted">{tr('এখনো দেওয়া হয়নি', 'not set yet')}</span>}</li>
        <li><span aria-hidden="true">🏠</span> {labels.drop}: {drop ? <strong>{tr('দেওয়া আছে', 'set')}</strong> : <span className="muted">{tr('এখনো দেওয়া হয়নি', 'not set yet')}</span>}</li>
        {tripKm != null && <li><span aria-hidden="true">📏</span> {tr(`রাস্তায় আনুমানিক ${num(tripKm, lang, 1)} কিমি`, `About ${num(tripKm, lang, 1)} km by road`)}{directions && <> · <a href={directions} target="_blank" rel="noreferrer">{tr('Google Maps-এ পথ দেখুন', 'Directions in Google Maps')}</a></>}</li>}
      </ul>

      {/* ---- my point ---- */}
      {!closed && (isFarmer || isBuyer) && (
        <div className="map-actions">
          <p className="small muted">
            {isFarmer
              ? tr('ক্রেতা কোথা থেকে ফসল নেবেন, সেই জায়গাটি দিন।', 'Mark where the buyer can pick up the crop.')
              : tr('ফসল কোথায় পৌঁছাতে হবে, সেই জায়গাটি দিন।', 'Mark where the crop should be delivered.')}
          </p>
          <div className="btn-row">
            <button type="button" className="btn btn-outline btn-sm" disabled={saving} onClick={locateMe}>
              <Icon name="pin" size={16} /> {saving ? tr('অবস্থান খোঁজা হচ্ছে…', 'Finding location…') : tr('আমার বর্তমান অবস্থান', 'Use my current location')}
            </button>
            <button type="button" className={`btn btn-sm ${placing ? 'btn-primary' : 'btn-outline'}`} disabled={saving} onClick={() => setPlacing((p) => !p)}>
              <Icon name="compass" size={16} /> {placing ? tr('ম্যাপে ক্লিক করুন… (বাতিল)', 'Click on the map… (cancel)') : myPoint ? tr('ম্যাপে বদলান', 'Change on map') : tr('ম্যাপে বেছে নিন', 'Pick on map')}
            </button>
          </div>
          {placeError && <Alert tone="warning">{geoError(placeError, tr)}</Alert>}
          {placing && <p className="small text-green">{tr(`ম্যাপে যেখানে ক্লিক করবেন, সেটাই ${myKind === 'pickup' ? 'ফসল নেওয়ার' : 'ডেলিভারির'} জায়গা হবে। দরকার হলে জুম করুন।`, `Click the exact ${myKind === 'pickup' ? 'pickup' : 'delivery'} point on the map. Zoom in if needed.`)}</p>}
        </div>
      )}

      {/* ---- live vehicle ---- */}
      <div className="map-live">
        {!m.delivery_method && !closed && (
          <p className="small muted">
            <Icon name="truck" size={16} /> {tr('ডেলিভারি শুরু হলে, যিনি গাড়ি আনবেন (কৃষক বা ক্রেতা) তাঁর লাইভ লোকেশন এখানে দেখা যাবে।', 'When the delivery starts, the live location of whoever brings the vehicle (farmer or buyer) shows here.')}
          </p>
        )}

        {onTheWay && isTracker && (
          sharing.sharing ? (
            <div className="share-box on">
              <strong><span className="live-dot on" /> {tr('আপনার লাইভ লোকেশন শেয়ার হচ্ছে', 'Sharing your live location')}</strong>
              <p className="small">
                {sharing.lastSent ? tr(`শেষ পাঠানো: ${timeAgo(new Date(sharing.lastSent).toISOString(), lang)}`, `Last sent ${timeAgo(new Date(sharing.lastSent).toISOString(), lang)}`) : tr('GPS খোঁজা হচ্ছে…', 'Finding GPS…')}
                {' · '}{tr('পৌঁছানো পর্যন্ত এই পেজটি খোলা রাখুন।', 'Keep this page open until you arrive.')}
              </p>
              <button type="button" className="btn btn-sm btn-danger-outline" onClick={() => sharing.stop().then((b) => toast.success(b.message)).catch((e) => toast.error(e.message))}>
                {tr('শেয়ার বন্ধ করুন', 'Stop sharing')}
              </button>
            </div>
          ) : (
            <div className="share-box">
              <strong>
                {comingToFarm
                  ? tr('আপনি গাড়ি নিয়ে ফসল আনতে যাচ্ছেন। রওনা হলে লাইভ লোকেশন চালু করুন, কৃষক দেখতে পাবেন আপনি কোথায় আছেন।', 'You are bringing the vehicle to the farm. Turn on live location when you leave so the farmer can follow you.')
                  : tr('আপনি ফসল পৌঁছে দিচ্ছেন। রওনা হলে লাইভ লোকেশন চালু করুন, ক্রেতা দেখতে পাবেন গাড়ি কোথায় আছে।', 'You are delivering the crop. Turn on live location when you leave so the buyer can follow the vehicle.')}
              </strong>
              <input
                className="input"
                maxLength={200}
                value={vehicle}
                onChange={(e) => setVehicle(e.target.value)}
                aria-label={tr('গাড়ির তথ্য', 'Vehicle details')}
                placeholder={tr('গাড়ির তথ্য (ঐচ্ছিক): যেমন পিকআপ, ঢাকা মেট্রো ন-১২৩৪, চালক ০১৭…', 'Vehicle details (optional): e.g. pickup, number plate, driver phone')}
              />
              <button type="button" className="btn btn-primary" onClick={() => sharing.start(vehicle.trim())}>
                <Icon name="truck" size={18} /> {tr('লাইভ লোকেশন শেয়ার শুরু করুন', 'Start sharing live location')}
              </button>
            </div>
          )
        )}
        {sharing.error && <Alert tone="warning">{sharing.error.message || geoError(sharing.error, tr)}</Alert>}

        {onTheWay && !isTracker && (
          vehiclePos ? (
            <div className={`eta-box ${stale ? 'stale' : ''}`}>
              <span className="eta-icon" aria-hidden="true">🚚</span>
              <div>
                {eta ? (
                  eta.arrived ? (
                    <strong>{comingToFarm ? tr('গাড়ি আপনার কাছে পৌঁছে গেছে', 'The vehicle has arrived') : tr('গাড়ি ডেলিভারির জায়গায় পৌঁছে গেছে', 'The vehicle has reached the delivery point')}</strong>
                  ) : (
                    <strong>{tr(`${num(eta.km, lang, 1)} কিমি দূরে · আনুমানিক ${num(eta.minutes, lang, 0)} মিনিটে পৌঁছাবে`, `${num(eta.km, lang, 1)} km away · about ${num(eta.minutes, lang, 0)} min`)}</strong>
                  )
                ) : (
                  <strong>{tr('গাড়ি রওনা হয়েছে', 'The vehicle is on the way')}</strong>
                )}
                <p className="small">
                  {trackerName} · {stale || !m.tracking_active
                    ? tr(`শেষ অবস্থান ${timeAgo(m.live_updated_at, lang)} (সংযোগ নেই বা শেয়ার বন্ধ)`, `Last seen ${timeAgo(m.live_updated_at, lang)} (offline or sharing stopped)`)
                    : tr(`আপডেট: ${timeAgo(m.live_updated_at, lang)}`, `Updated ${timeAgo(m.live_updated_at, lang)}`)}
                </p>
                {m.vehicle_info && <p className="small"><Icon name="truck" size={14} /> {m.vehicle_info}</p>}
                {!destination && <p className="small muted">{comingToFarm ? tr('ফসল নেওয়ার জায়গা দিলে দূরত্ব ও সময় দেখা যাবে।', 'Set the pickup point to see distance and time.') : tr('ডেলিভারির জায়গা দিলে দূরত্ব ও সময় দেখা যাবে।', 'Set the delivery point to see distance and time.')}</p>}
              </div>
            </div>
          ) : (
            <p className="small muted">
              <Icon name="truck" size={16} /> {tr(`${trackerName} রওনা হয়ে লাইভ লোকেশন চালু করলে গাড়িটি ম্যাপে দেখা যাবে।`, `The vehicle appears on the map once ${trackerName} sets off and turns on live location.`)}
            </p>
          )
        )}
      </div>
    </Card>
  )
}
