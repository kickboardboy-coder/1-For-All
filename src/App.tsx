import { Navigate, Route, Routes } from 'react-router'
import RequireAuth from './components/RequireAuth'
import RequireGuest from './components/RequireGuest'
import RootLayout from './layouts/RootLayout'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import PlannerPage from './pages/PlannerPage'
import PlansPage from './pages/PlansPage'
import PolicyPage from './pages/PolicyPage'
import ResultPage from './pages/ResultPage'
import SignUpPage from './pages/SignUpPage'

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
          <Route path="/planner/new" element={<PlannerPage />} />
          <Route path="/planner/:planId" element={<PlannerPage />} />
          <Route path="/result/:planId" element={<ResultPage />} />
        </Route>
        <Route path="/terms" element={<PolicyPage kind="terms" />} />
        <Route path="/privacy" element={<PolicyPage kind="privacy" />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

export default App
