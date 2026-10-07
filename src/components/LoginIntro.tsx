import type { ReactNode } from 'react'
import chevron from '../assets/login-chevron.svg'
import dot from '../assets/login-dot.svg'
import river from '../assets/login-river.svg'
import route from '../assets/login-route.svg'
import sparkles from '../assets/login-sparkles.svg'
import sparklesSmall from '../assets/login-sparkles-small.svg'

const places = [
  { number: '1', name: '가고 싶은 곳', className: 'login-place-1' },
  { number: '2', name: '맛있는 한 끼', className: 'login-place-2' },
  { number: '3', name: '쉬어가는 곳', className: 'login-place-3' },
]

function LoginIntro({
  title = (
    <>
      계획은 가볍게,
      <br />
      여행은 즐겁게.
    </>
  ),
}: {
  title?: ReactNode
}) {
  return (
    <aside className="login-intro">
      <p className="login-intro-kicker">
        <img src={sparkles} alt="" />
        여행이 쉬워지는 순간, 의쉬행
      </p>
      <div className="login-intro-copy">
        <h2>{title}</h2>
        <p>
          가고 싶은 곳만 담아주세요.
          <br />
          복잡한 동선은 의쉬행이 정리해 드려요.
        </p>
      </div>
      <div className="login-map" aria-hidden="true">
        {Array.from({ length: 12 }, (_, index) => (
          <span key={index} className={`login-map-block login-map-block-${index + 1}`} />
        ))}
        <span className="login-map-park" />
        <span className="login-map-garden" />
        <span className="login-map-river">
          <img src={river} alt="" />
        </span>
        <img className="login-map-route" src={route} alt="" />
        {places.map((place) => (
          <span key={place.number} className={`login-place ${place.className}`}>
            <span className="login-place-pin">{place.number}</span>
            <span className="login-place-name">{place.name}</span>
          </span>
        ))}
        <span className="login-map-done">
          <img src={sparklesSmall} alt="" />
          편한 순서로 정리했어요!
        </span>
      </div>
      <ul className="login-steps">
        <li>
          <img src={dot} alt="" />
          장소 담기
          <img src={chevron} alt="" />
        </li>
        <li>
          <img src={dot} alt="" />
          동선 정리
          <img src={chevron} alt="" />
        </li>
        <li>
          <img src={dot} alt="" />
          가볍게 출발
        </li>
      </ul>
      <p className="login-intro-promise">의외로 쉬운 여행, 의외로 쉬운 행복</p>
    </aside>
  )
}

export default LoginIntro
