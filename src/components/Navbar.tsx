import { Link, useNavigate } from 'react-router'
import { logout } from '../api/auth'
import gnbLogo from '../assets/gnb-logo.svg'
import helpIcon from '../assets/help-icon.svg'
import { useAuth } from '../contexts/AuthContext'

function Navbar() {
  const navigate = useNavigate()
  const { user, isLoggedIn } = useAuth()
  const userLabel = user?.displayName || user?.email || '여행자님'

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="navbar">
      <div className="navbar-brand">
        <Link to="/plans" className="navbar-brand-link">
          <span className="navbar-mark">
            <img src={gnbLogo} alt="" />
          </span>
          <span className="navbar-title">의외로 쉬운 여행</span>
        </Link>
        <p className="navbar-tagline">의쉬행 · 의외로 쉬운 여행, 의외로 쉬운 행복</p>
      </div>
      <div className="navbar-actions">
        {isLoggedIn && (
          <p className="navbar-user">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="8" cy="5" r="2.5" />
              <path d="M3.5 13.5c.6-2.2 2.3-3.5 4.5-3.5s3.9 1.3 4.5 3.5" />
            </svg>
            <span>{userLabel}</span>
          </p>
        )}
        <div className="navbar-help">
          <img src={helpIcon} alt="" />
          <span>이용 방법</span>
        </div>
        {isLoggedIn && (
          <button type="button" className="navbar-logout" onClick={handleLogout}>
            로그아웃
          </button>
        )}
      </div>
    </header>
  )
}

export default Navbar
