import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Layout({ children }) {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* Top header */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <Link to="/" className="text-green-400 font-bold text-lg tracking-tight">
          ♠ Poker Tracker
        </Link>
        {user && (
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-sm hidden sm:block">{profile?.name ?? user.email}</span>
            <button
              onClick={handleSignOut}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Sign out
            </button>
          </div>
        )}
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 pb-24">
        {children}
      </main>

      {/* Bottom nav */}
      {user && (
        <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex z-10">
          <NavTab to="/" label="Sessions" icon="🃏" active={location.pathname === '/'} />
          <NavTab to="/stats" label="Stats" icon="📊" active={location.pathname === '/stats'} />
        </nav>
      )}
    </div>
  )
}

function NavTab({ to, label, icon, active }) {
  return (
    <Link
      to={to}
      className={`flex-1 flex flex-col items-center gap-0.5 py-3 text-xs transition-colors ${
        active ? 'text-green-400' : 'text-gray-500 hover:text-gray-300'
      }`}
    >
      <span className="text-lg leading-none">{icon}</span>
      <span>{label}</span>
    </Link>
  )
}
