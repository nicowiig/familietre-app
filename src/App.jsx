import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage }       from './pages/LoginPage'
import { AccessPage }      from './pages/AccessPage'
import { HomePage }        from './pages/HomePage'
import { SearchPage }      from './pages/SearchPage'
import { PersonPage }      from './pages/PersonPage'
import { TreePage }        from './pages/TreePage'
import { BranchesPage }    from './pages/BranchesPage'
import { BranchDetailPage } from './pages/BranchDetailPage'
import { AdminPage }       from './pages/AdminPage'
import { ChangelogPage }   from './pages/ChangelogPage'

export default function App() {
  return (
    <BrowserRouter basename="/familietre-app">
      <AuthProvider>
        <Routes>
          {/* Offentlige ruter */}
          <Route path="/logg-inn" element={<LoginPage />} />
          <Route path="/tilgang"  element={<AccessPage />} />

          {/* Beskyttede ruter */}
          <Route path="/" element={
            <ProtectedRoute><HomePage /></ProtectedRoute>
          } />
          <Route path="/søk" element={
            <ProtectedRoute><SearchPage /></ProtectedRoute>
          } />
          <Route path="/person/:id" element={
            <ProtectedRoute><PersonPage /></ProtectedRoute>
          } />
          <Route path="/tre" element={
            <ProtectedRoute><TreePage /></ProtectedRoute>
          } />
          <Route path="/grener" element={
            <ProtectedRoute><BranchesPage /></ProtectedRoute>
          } />
          <Route path="/grener/:id" element={
            <ProtectedRoute><BranchDetailPage /></ProtectedRoute>
          } />
          <Route path="/hva-er-nytt" element={
            <ProtectedRoute><ChangelogPage /></ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute requireAdmin><AdminPage /></ProtectedRoute>
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
