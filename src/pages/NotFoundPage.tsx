import { Link } from 'react-router'

function NotFoundPage() {
  return (
    <section className="not-found">
      <p className="not-found-code">404</p>
      <h1>페이지를 찾을 수 없습니다</h1>
      <p className="not-found-description">주소가 바뀌었거나, 없는 페이지입니다.</p>
      <Link to="/plans" className="not-found-link">
        여행 플랜으로 돌아가기
      </Link>
    </section>
  )
}

export default NotFoundPage
