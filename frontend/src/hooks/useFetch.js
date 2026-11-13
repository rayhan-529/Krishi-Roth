/**
 * Loads data from the API and tracks loading/error state.
 *
 *   const { data, meta, loading, error, reload } = useFetch(() => get('/harvests', filters), [filters])
 */
import { useCallback, useEffect, useState } from 'react'

export function useFetch(loader, deps = []) {
  const [state, setState] = useState({ data: null, meta: null, loading: true, error: null })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true, error: null }))
    loader()
      .then((body) => alive && setState({ data: body ? body.data : null, meta: (body && body.meta) || null, loading: false, error: null }))
      .catch((error) => alive && setState((s) => ({ ...s, loading: false, error })))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const reload = useCallback(() => setTick((n) => n + 1), [])
  const setData = useCallback((update) => setState((s) => ({ ...s, data: typeof update === 'function' ? update(s.data) : update })), [])

  return { ...state, reload, setData }
}

/** Keeps form values and their field errors together. */
export function useForm(initial) {
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState({})

  const set = useCallback((name, value) => {
    setValues((v) => ({ ...v, [name]: value }))
    setErrors((e) => (e[name] ? { ...e, [name]: undefined } : e))
  }, [])

  const bind = useCallback(
    (name) => ({
      name,
      value: values[name] ?? '',
      onChange: (event) => set(name, event.target.type === 'checkbox' ? event.target.checked : event.target.value),
      error: errors[name],
    }),
    [values, errors, set],
  )

  return { values, setValues, errors, setErrors, set, bind }
}
