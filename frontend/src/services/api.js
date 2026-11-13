/**
 * The one place that talks to the backend API.
 *
 *   import { get, post } from '../services/api'
 *   const body = await get('/listings', { page: 2 })   // body = { success, message, data, meta }
 *
 * - Adds the login token and the chosen language to every request.
 * - Turns every failure into an Error with a readable message, the HTTP
 *   status and field errors (err.errors) for forms.
 */
import axios from 'axios'

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '')

const TOKEN_KEY = 'kr_token'
let token = localStorage.getItem(TOKEN_KEY)
let language = localStorage.getItem('kr_lang') || 'bn'
let unauthorizedHandler = null

const api = axios.create({ baseURL: `${API_URL}/api`, timeout: 75000 })

export function getToken() {
  return token
}

export function setToken(value) {
  token = value || null
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export function setApiLanguage(value) {
  language = value
}

/** Called when the server says the login is no longer valid (401). */
export function onUnauthorized(handler) {
  unauthorizedHandler = handler
}

api.interceptors.request.use((config) => {
  if (token) config.headers.Authorization = `Bearer ${token}`
  config.headers['Accept-Language'] = language
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const response = error.response
    const bn = language !== 'en'
    let message

    if (!response) {
      message =
        error.code === 'ECONNABORTED'
          ? bn
            ? 'সার্ভার সাড়া দিচ্ছে না। একটু পরে আবার চেষ্টা করুন।'
            : 'The server is not responding. Please try again shortly.'
          : bn
            ? 'সার্ভারের সঙ্গে সংযোগ করা যাচ্ছে না। ইন্টারনেট সংযোগ দেখুন।'
            : 'Cannot reach the server. Please check your internet connection.'
    } else {
      message =
        (response.data && response.data.message) ||
        (bn ? 'কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।' : 'Something went wrong. Please try again.')
    }

    const err = new Error(message)
    err.status = response ? response.status : 0
    err.errors = (response && response.data && response.data.errors) || {}

    if (err.status === 401 && token && unauthorizedHandler) unauthorizedHandler()
    return Promise.reject(err)
  },
)

/** Removes empty values so they are not sent as filters. */
function clean(params) {
  if (!params) return undefined
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined),
  )
}

export const get = (url, params) => api.get(url, { params: clean(params) }).then((r) => r.data)
export const post = (url, data, config) => api.post(url, data, config).then((r) => r.data)
export const put = (url, data, config) => api.put(url, data, config).then((r) => r.data)
export const patch = (url, data) => api.patch(url, data).then((r) => r.data)
export const del = (url) => api.delete(url).then((r) => r.data)

/** Downloads a protected file (e.g. a verification document) as a blob URL. */
export async function getBlobUrl(url) {
  const response = await api.get(url, { responseType: 'blob' })
  return URL.createObjectURL(response.data)
}

/** Turns a stored photo path into a full URL. */
export function mediaUrl(path) {
  if (!path) return null
  return /^https?:\/\//.test(path) ? path : `${API_URL}${path}`
}

/** Builds multipart form data (for forms with photos). Arrays are sent as JSON. */
export function toFormData(values, files = [], fileField = 'images') {
  const form = new FormData()
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined) continue
    form.append(key, Array.isArray(value) ? JSON.stringify(value) : String(value))
  }
  for (const file of files) form.append(fileField, file)
  return form
}

export default api
