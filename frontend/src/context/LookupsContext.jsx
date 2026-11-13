/**
 * Lists loaded once from /api/meta/lookups: roles, divisions, districts,
 * crop categories, crops and expense categories, plus quick lookups by id.
 */
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { get } from '../services/api'

const LookupsContext = createContext(null)

const EMPTY = { roles: [], divisions: [], districts: [], crop_categories: [], crops: [], expense_categories: [] }

export function LookupsProvider({ children }) {
  const [data, setData] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    setLoading(true)
    get('/meta/lookups')
      .then((body) => alive && (setData(body.data), setError(null)))
      .catch((err) => alive && setError(err))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [attempt])

  const value = useMemo(() => {
    const byId = (list) => Object.fromEntries(list.map((item) => [item.id, item]))
    return {
      ...data,
      loading,
      error,
      retry: () => setAttempt((n) => n + 1),
      cropById: byId(data.crops),
      districtById: byId(data.districts),
      divisionById: byId(data.divisions),
      categoryById: byId(data.crop_categories),
      roleByCode: Object.fromEntries(data.roles.map((r) => [r.code, r])),
    }
  }, [data, loading, error])

  return <LookupsContext.Provider value={value}>{children}</LookupsContext.Provider>
}

export function useLookups() {
  return useContext(LookupsContext)
}
