import { NavLink, Outlet, useLocation } from 'react-router'
import ErrorBoundary from '../components/ErrorBoundary'
import Navbar from '../components/Navbar'

function RootLayout() {
  const location = useLocation()

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        본문으로 건너뛰기
      </a>
      <Navbar />
      <main id="main" className="app-main" tabIndex={-1}>
        <ErrorBoundary key={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
      <footer className="app-footer">
        <p>의쉬행 · 여행 준비는 가볍게, 행복은 가까이</p>
        <div className="app-footer-policies">
          <NavLink to="/terms">이용약관</NavLink>
          <NavLink to="/privacy">개인정보 처리방침</NavLink>
        </div>
      </footer>
    </div>
  )
}

export default RootLayout
