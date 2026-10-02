import { Navigate, Route, Routes } from 'react-router'
import RootLayout from './layouts/RootLayout'
import LoginPage from './pages/LoginPage'
import PlannerPage from './pages/PlannerPage'
import PlansPage from './pages/PlansPage'
import ResultPage from './pages/ResultPage'
import SignUpPage from './pages/SignUpPage'

function App() {
  return (
    <Routes>
      <Route element={<RootLayout />}>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/plans" element={<PlansPage />} />
        <Route path="/planner" element={<PlannerPage />} />
        <Route path="/result" element={<ResultPage />} />
      </Route>
    </Routes>
  )
}

export default App
