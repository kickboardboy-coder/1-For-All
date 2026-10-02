import { Outlet } from 'react-router'
import Navbar from '../components/Navbar'

function RootLayout() {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="app-main">
        <Outlet />
      </main>
      <footer className="app-footer">
        <p>의쉬행 · 여행 준비는 가볍게, 행복은 가까이</p>
        <p>이용약관 · 개인정보 처리방침</p>
      </footer>
    </div>
  )
}

export default RootLayout
