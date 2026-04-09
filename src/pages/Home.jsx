import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'

export default function Home() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchSessions()
  }, [user])

  async function fetchSessions() {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('sessions')
      .select('*, player_sessions(id, cash_out)')
      .order('date', { ascending: false })
    setSessions(data ?? [])
    setLoading(false)
  }

  async function createSession() {
    setCreating(true)
    setError('')
    const { data, error } = await supabase
      .from('sessions')
      .insert({ created_by: user.id, date: new Date().toISOString() })
      .select()
      .single()
    setCreating(false)
    if (error) setError(error.message)
    else navigate(`/session/${data.id}`)
  }

  function sessionStatus(session) {
    const players = session.player_sessions ?? []
    if (players.length === 0) return { label: 'Empty', color: 'text-gray-500' }
    const allDone = players.every((p) => p.cash_out !== null)
    if (allDone) return { label: 'Settled', color: 'text-green-400' }
    return { label: 'In progress', color: 'text-yellow-400' }
  }

  return (
    <Layout>
      <div className="space-y-6">
        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">
              Hey, {profile?.name ?? 'Player'} 👋
            </h2>
            <p className="text-gray-400 text-sm">Your poker sessions</p>
          </div>
          <button
            onClick={createSession}
            disabled={creating}
            className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors"
          >
            {creating ? '…' : '+ New session'}
          </button>
        </div>

        {loading ? (
          <div className="text-center text-gray-500 py-8">Loading…</div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">🃏</div>
            <p className="text-gray-400">No sessions yet. Start one!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => {
              const { label, color } = sessionStatus(s)
              return (
                <Link
                  key={s.id}
                  to={`/session/${s.id}`}
                  className="block bg-gray-900 border border-gray-800 rounded-xl px-4 py-4 hover:border-gray-600 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">
                        {new Date(s.date).toLocaleDateString('en-US', {
                          weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
                        })}
                      </p>
                      <p className="text-gray-400 text-sm">
                        {s.player_sessions?.length ?? 0} player{s.player_sessions?.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <span className={`text-sm font-medium ${color}`}>{label}</span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </Layout>
  )
}
