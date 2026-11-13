/**
 * Only lets logged-in users (optionally of certain roles) see a page.
 * This is for convenience only — the backend checks every permission again.
 */
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { HOME_BY_ROLE } from '../utils/nav'
import { Loader } from './ui'

export default function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Loader />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (roles && !roles.includes(user.role)) return <Navigate to={HOME_BY_ROLE[user.role] || '/'} replace />
  return <Outlet />
}
