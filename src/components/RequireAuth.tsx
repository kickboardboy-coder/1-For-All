import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../contexts/AuthContext'
import LoadingSpinner from './LoadingSpinner'

function RequireAuth() {
  const { isLoggedIn, isLoading } = useAuth()

  if (isLoading) {
    return <LoadingSpinner size="page" label="로그인 상태를 확인하는 중입니다." />
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

export default RequireAuth
