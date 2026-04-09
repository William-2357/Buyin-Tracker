import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

export default function Stats() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('net') // 'net' | 'sessions' | 'buyIn' | 'name'

  useEffect(() => {
    async function load() {
      // Fetch all completed player_sessions (cash_out not null)
      const { data } = await supabase
        .from('player_sessions')
        .select('buy_ins, cash_out, players(id, name)')
        .not('cash_out', 'is', null)

      if (!data) { setLoading(false); return }

      // Aggregate by player
      const byPlayer = {}
      for (const ps of data) {
        const pid = ps.players?.id
        const name = ps.players?.name ?? 'Unknown'
        if (!pid) continue

        if (!byPlayer[pid]) {
          byPlayer[pid] = { name, sessions: 0, totalBuyIn: 0, totalCashOut: 0 }
        }

        const buyIn = (ps.buy_ins ?? []).reduce((s, v) => s + v, 0)
        byPlayer[pid].sessions += 1
        byPlayer[pid].totalBuyIn += buyIn
        byPlayer[pid].totalCashOut += ps.cash_out
      }

      setRows(Object.values(byPlayer))
      setLoading(false)
    }
    load()
  }, [])

  const sorted = [...rows].sort((a, b) => {
    if (sortBy === 'net') return (b.totalCashOut - b.totalBuyIn) - (a.totalCashOut - a.totalBuyIn)
    if (sortBy === 'sessions') return b.sessions - a.sessions
    if (sortBy === 'buyIn') return b.totalBuyIn - a.totalBuyIn
    if (sortBy === 'name') return a.name.localeCompare(b.name)
    return 0
  })

  const cols = [
    { key: 'name', label: 'Player' },
    { key: 'sessions', label: 'Sessions' },
    { key: 'buyIn', label: 'Total in' },
    { key: 'net', label: 'Net' },
  ]

  return (
    <Layout>
      <div className="space-y-6 pb-8">
        <div>
          <h2 className="text-xl font-bold text-white">Lifetime Stats</h2>
          <p className="text-gray-400 text-sm">All completed sessions</p>
        </div>

        {loading ? (
          <div className="text-center text-gray-500 py-16">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">📊</div>
            <p className="text-gray-400">No completed sessions yet.</p>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            {/* Sort tabs */}
            <div className="flex border-b border-gray-800">
              {cols.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setSortBy(c.key)}
                  className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                    sortBy === c.key
                      ? 'text-green-400 border-b-2 border-green-500'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Rows */}
            <div className="divide-y divide-gray-800">
              {sorted.map((p, i) => {
                const net = p.totalCashOut - p.totalBuyIn
                const netColor = net > 0 ? 'text-green-400' : net < 0 ? 'text-red-400' : 'text-gray-400'
                const netSign = net >= 0 ? '+' : ''
                return (
                  <div key={p.name} className="px-4 py-3 flex items-center gap-3">
                    <span className="text-gray-600 text-xs w-5 text-right">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{p.name}</p>
                      <p className="text-gray-500 text-xs">
                        {p.sessions} session{p.sessions !== 1 ? 's' : ''} · ${p.totalBuyIn.toFixed(0)} in
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${netColor}`}>
                        {netSign}${Math.abs(net).toFixed(2)}
                      </p>
                      <p className="text-gray-600 text-xs">
                        out ${p.totalCashOut.toFixed(0)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Totals footer */}
            {rows.length > 0 && (() => {
              const totalIn = rows.reduce((s, r) => s + r.totalBuyIn, 0)
              const totalOut = rows.reduce((s, r) => s + r.totalCashOut, 0)
              return (
                <div className="border-t border-gray-700 px-4 py-3 flex justify-between text-xs text-gray-500">
                  <span>{rows.length} players tracked</span>
                  <span>Total circulated: ${totalIn.toFixed(0)}</span>
                </div>
              )
            })()}
          </div>
        )}
      </div>
    </Layout>
  )
}
