import { Outlet } from 'react-router'

function RootLayout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <p className="brand-name">의외로 쉬운 여행</p>
          <p className="brand-tagline">의쉬행 · 의외로 쉬운 여행, 의외로 쉬운 행복</p>
        </div>
      </header>
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
