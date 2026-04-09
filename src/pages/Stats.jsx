import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

export default function Stats() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('player_sessions')
        .select('buy_ins, cash_out, players(id, name)')
        .not('cash_out', 'is', null)

      if (!data) { setLoading(false); return }

      const byPlayer = {}
      for (const ps of data) {
        const pid = ps.players?.id
        const name = ps.players?.name ?? 'Unknown'
        if (!pid) continue

        if (!byPlayer[pid]) {
          byPlayer[pid] = { name, sessions: 0, totalBuyIn: 0, totalCashOut: 0 }
        }

        const buyIn = (ps.buy_ins ?? []).reduce((s, v) => s + Number(v), 0)
        byPlayer[pid].sessions += 1
        byPlayer[pid].totalBuyIn += buyIn
        byPlayer[pid].totalCashOut += Number(ps.cash_out)
      }

      // Sort by net descending
      const sorted = Object.values(byPlayer).sort(
        (a, b) => (b.totalCashOut - b.totalBuyIn) - (a.totalCashOut - a.totalBuyIn)
      )
      setRows(sorted)
      setLoading(false)
    }
    load()
  }, [])

  return (
    <Layout>
      <div className="space-y-6 pb-8">
        <div>
          <h2 className="text-xl font-bold text-white">Lifetime Stats</h2>
          <p className="text-gray-400 text-sm">All completed sessions · sorted by net</p>
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
            {/* Column headers */}
            <div className="grid grid-cols-3 px-4 py-2 border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wide">
              <span>Player</span>
              <span className="text-right">Total in</span>
              <span className="text-right">Net</span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-gray-800">
              {rows.map((p) => {
                const net = p.totalCashOut - p.totalBuyIn
                const netColor = net > 0 ? 'text-green-400' : net < 0 ? 'text-red-400' : 'text-gray-400'
                return (
                  <div key={p.name} className="grid grid-cols-3 px-4 py-3 items-center">
                    <div>
                      <p className="text-white font-medium">{p.name}</p>
                      <p className="text-gray-600 text-xs">{p.sessions} session{p.sessions !== 1 ? 's' : ''}</p>
                    </div>
                    <p className="text-gray-300 text-right">${p.totalBuyIn.toFixed(2)}</p>
                    <p className={`font-bold text-right ${netColor}`}>
                      {net >= 0 ? '+' : ''}${net.toFixed(2)}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
