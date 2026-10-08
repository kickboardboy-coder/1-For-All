import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../contexts/AuthContext'

function RequireGuest() {
  const { isLoggedIn, isLoading } = useAuth()

  if (isLoading) {
    return null
  }

  if (isLoggedIn) {
    return <Navigate to="/plans" replace />
  }

  return <Outlet />
}

export default RequireGuest
