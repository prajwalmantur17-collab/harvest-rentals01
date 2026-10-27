import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { FullPageSpinner } from '../components/ui'
import type { Role } from '../types'

export function homeFor(role: Role | null | undefined): string {
  if (role === 'farmer') return '/farmer'
  if (role === 'owner') return '/owner'
  return '/role'
}

/** "/" decides where a visitor belongs. Each target page only redirects to places that cannot redirect back. */
export function RootRedirect() {
  const { session, profile, loading } = useAuth()
  if (loading) return <FullPageSpinner />
  if (!session) return <Navigate to="/login" replace />
  return <Navigate to={homeFor(profile?.role)} replace />
}

/** Requires a signed-in user with a chosen role. If `role` is given, only that role may enter. */
export function RequireRole({ role, children }: { role?: Role; children: ReactNode }) {
  const { session, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageSpinner />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!profile?.role) return <Navigate to="/role" replace />
  if (role && profile.role !== role) return <Navigate to={homeFor(profile.role)} replace />
  return <>{children}</>
}
