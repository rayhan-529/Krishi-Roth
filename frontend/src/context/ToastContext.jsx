/**
 * Small pop-up messages.
 *   const toast = useToast()
 *   toast.success('সংরক্ষণ হয়েছে')   toast.error(err.message)
 */
import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const ToastContext = createContext(null)
let nextId = 1

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const remove = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), [])

  const show = useCallback(
    (type, message) => {
      if (!message) return
      const id = nextId++
      setToasts((list) => [...list.slice(-3), { id, type, message }])
      setTimeout(() => remove(id), type === 'error' ? 6000 : 3500)
    },
    [remove],
  )

  const api = useMemo(
    () => ({ success: (m) => show('success', m), error: (m) => show('error', m), info: (m) => show('info', m) }),
    [show],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`} onClick={() => remove(t.id)}>
            <span aria-hidden="true">{t.type === 'success' ? '✓' : t.type === 'error' ? '!' : 'i'}</span>
            <p>{t.message}</p>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
