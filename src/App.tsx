import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import RequireAuth from './components/RequireAuth'
import RequireGuest from './components/RequireGuest'
import SkeletonLoader from './components/SkeletonLoader'
import RootLayout from './layouts/RootLayout'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import PlansPage from './pages/PlansPage'
import PolicyPage from './pages/PolicyPage'
import SignUpPage from './pages/SignUpPage'

const PlannerPage = lazy(() => import('./pages/PlannerPage'))
const ResultPage = lazy(() => import('./pages/ResultPage'))

function PlannerFallback() {
  return (
    <section className="planner-page">
      <SkeletonLoader variant="pocket" label="지도 화면을 불러오는 중입니다." />
    </section>
  )
}

function ResultFallback() {
  return (
    <section className="result-page">
      <SkeletonLoader variant="result" label="결과 화면을 불러오는 중입니다." />
    </section>
  )
}

function LazyRoute({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  return <Suspense fallback={fallback}>{children}</Suspense>
}

function App() {
  return (
    <Routes>
      <Route element={<RootLayout />}>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route element={<RequireGuest />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
        </Route>
        <Route element={<RequireAuth />}>
          <Route path="/plans" element={<PlansPage />} />
          <Route
            path="/planner/new"
            element={
              <LazyRoute fallback={<PlannerFallback />}>
                <PlannerPage />
              </LazyRoute>
            }
          />
          <Route
            path="/planner/:planId"
            element={
              <LazyRoute fallback={<PlannerFallback />}>
                <PlannerPage />
              </LazyRoute>
            }
          />
          <Route
            path="/result/:planId"
            element={
              <LazyRoute fallback={<ResultFallback />}>
                <ResultPage />
              </LazyRoute>
            }
          />
        </Route>
        <Route path="/terms" element={<PolicyPage kind="terms" />} />
        <Route path="/privacy" element={<PolicyPage kind="privacy" />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

export default App
