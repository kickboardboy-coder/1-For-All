import { Link } from 'react-router'
import gnbLogo from '../assets/gnb-logo.svg'
import helpIcon from '../assets/help-icon.svg'

function Navbar() {
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
      <div className="navbar-help">
        <img src={helpIcon} alt="" />
        <span>이용 방법</span>
      </div>
    </header>
  )
}

export default Navbar
