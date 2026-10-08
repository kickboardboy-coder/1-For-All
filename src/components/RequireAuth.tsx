import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../contexts/AuthContext'

function RequireAuth() {
  const { isLoggedIn, isLoading } = useAuth()

  if (isLoading) {
    return null
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

export default RequireAuth
