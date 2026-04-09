import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { calculateSettlement, adjustForMissingMoney } from '../lib/settlement'
import Layout from '../components/Layout'

export default function Session() {
  const { id } = useParams()

  const [session, setSession] = useState(null)
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)

  const [newName, setNewName] = useState('')
  const [addingPlayer, setAddingPlayer] = useState(false)

  const [missingMoney, setMissingMoney] = useState('')

  useEffect(() => {
    fetchAll()
  }, [id])

  async function fetchAll() {
    setLoading(true)
    const [{ data: sess }, { data: ps }] = await Promise.all([
      supabase.from('sessions').select('*').eq('id', id).single(),
      supabase.from('player_sessions').select('*').eq('session_id', id).order('created_at'),
    ])
    setSession(sess)
    setPlayers(ps ?? [])
    setLoading(false)
  }

  async function addPlayer() {
    const name = newName.trim()
    if (!name) return
    setAddingPlayer(true)
    await supabase.from('player_sessions').insert({ session_id: id, name, buy_ins: [], cash_out: null })
    setNewName('')
    await fetchAll()
    setAddingPlayer(false)
  }

  async function removePlayer(playerId) {
    await supabase.from('player_sessions').delete().eq('id', playerId)
    await fetchAll()
  }

  async function addBuyIn(player, amount) {
    const newBuyIns = [...(player.buy_ins ?? []), amount]
    await supabase.from('player_sessions').update({ buy_ins: newBuyIns }).eq('id', player.id)
    await fetchAll()
  }

  async function removeBuyIn(player, index) {
    const newBuyIns = player.buy_ins.filter((_, i) => i !== index)
    await supabase.from('player_sessions').update({ buy_ins: newBuyIns }).eq('id', player.id)
    await fetchAll()
  }

  async function setCashOut(player, amount) {
    await supabase.from('player_sessions').update({ cash_out: amount }).eq('id', player.id)
    await fetchAll()
  }

  async function clearCashOut(player) {
    await supabase.from('player_sessions').update({ cash_out: null }).eq('id', player.id)
    await fetchAll()
  }

  if (loading) {
    return (
      <Layout>
        <div className="text-center text-gray-500 py-16">Loading…</div>
      </Layout>
    )
  }

  if (!session) {
    return (
      <Layout>
        <div className="text-center text-gray-400 py-16">Session not found.</div>
      </Layout>
    )
  }

  const allSettled = players.length > 0 && players.every((p) => p.cash_out !== null)
  const potTotal = players.reduce((s, p) => s + (p.buy_ins ?? []).reduce((a, b) => a + b, 0), 0)
  const cashOutTotal = players.reduce((s, p) => s + (p.cash_out ?? 0), 0)
  const missingAmt = parseFloat(missingMoney) || 0

  const playerNets = players.map((p) => ({
    name: p.name,
    net: (p.cash_out ?? 0) - (p.buy_ins ?? []).reduce((s, v) => s + v, 0),
    totalBuyIn: (p.buy_ins ?? []).reduce((s, v) => s + v, 0),
  }))

  const adjustedNets = adjustForMissingMoney(playerNets, missingAmt)
  const transactions = allSettled ? calculateSettlement(adjustedNets) : []

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-white">
            {new Date(session.date).toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric',
            })}
          </h2>
          <p className="text-gray-400 text-sm">{players.length} player{players.length !== 1 ? 's' : ''}</p>
        </div>

        {/* Add player */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addPlayer()}
            placeholder="Player name"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition-colors"
          />
          <button
            onClick={addPlayer}
            disabled={addingPlayer || !newName.trim()}
            className="bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors"
          >
            Add
          </button>
        </div>

        {/* Player cards */}
        {players.length === 0 ? (
          <div className="text-center py-12 text-gray-500">Add players above to get started.</div>
        ) : (
          <div className="space-y-3">
            {players.map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
                onAddBuyIn={(amt) => addBuyIn(player, amt)}
                onRemoveBuyIn={(i) => removeBuyIn(player, i)}
                onSetCashOut={(amt) => setCashOut(player, amt)}
                onClearCashOut={() => clearCashOut(player)}
                onRemove={() => removePlayer(player.id)}
              />
            ))}
          </div>
        )}

        {/* Settlement */}
        {allSettled && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-white font-semibold">Settlement</h3>
              <span className="text-xs text-gray-500">Pot: ${potTotal} · Out: ${cashOutTotal}</span>
            </div>

            {potTotal !== cashOutTotal && (
              <div className="px-4 py-3 border-b border-gray-800 bg-yellow-900/10">
                <p className="text-yellow-400 text-xs mb-2">
                  ⚠ ${Math.abs(potTotal - cashOutTotal).toFixed(2)} {potTotal > cashOutTotal ? 'missing from' : 'extra in'} pot. Adjust:
                </p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={missingMoney}
                    onChange={(e) => setMissingMoney(e.target.value)}
                    placeholder={`e.g. ${Math.abs(potTotal - cashOutTotal).toFixed(2)}`}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-yellow-500"
                  />
                  <button
                    onClick={() => setMissingMoney(String(Math.abs(potTotal - cashOutTotal).toFixed(2)))}
                    className="text-yellow-400 hover:text-yellow-300 text-xs px-2 border border-yellow-700 rounded-lg transition-colors"
                  >
                    Auto-fill
                  </button>
                </div>
              </div>
            )}

            <div className="divide-y divide-gray-800">
              {transactions.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">All square! 🎉</p>
              ) : (
                transactions.map((t, i) => (
                  <div key={i} className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-red-400 font-medium">{t.from}</span>
                      <span className="text-gray-600">pays</span>
                      <span className="text-green-400 font-medium">{t.to}</span>
                    </div>
                    <span className="text-white font-bold">${t.amount.toFixed(2)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {!allSettled && players.length > 0 && (
          <p className="text-center text-gray-600 text-sm">
            Settlement appears when all players have cashed out.
          </p>
        )}
      </div>
    </Layout>
  )
}

function PlayerCard({ player, onAddBuyIn, onRemoveBuyIn, onSetCashOut, onClearCashOut, onRemove }) {
  const [buyInInput, setBuyInInput] = useState('')
  const [cashOutInput, setCashOutInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(true)

  const totalBuyIn = (player.buy_ins ?? []).reduce((s, v) => s + v, 0)
  const net = player.cash_out !== null ? player.cash_out - totalBuyIn : null
  const netColor = net === null ? 'text-gray-500' : net >= 0 ? 'text-green-400' : 'text-red-400'

  async function handleAddBuyIn() {
    const amount = parseFloat(buyInInput)
    if (isNaN(amount) || amount <= 0) return
    setSaving(true)
    await onAddBuyIn(amount)
    setBuyInInput('')
    setSaving(false)
  }

  async function handleSetCashOut() {
    const amount = parseFloat(cashOutInput)
    if (isNaN(amount) || amount < 0) return
    setSaving(true)
    await onSetCashOut(amount)
    setCashOutInput('')
    setSaving(false)
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      {/* Player header */}
      <div
        className="px-4 py-3 flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <span className="text-white font-semibold">{player.name}</span>
          {player.cash_out !== null && (
            <span className={`text-sm font-bold ${netColor}`}>
              {net >= 0 ? '+' : ''}${Math.abs(net).toFixed(2)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-gray-500 text-sm">In: ${totalBuyIn}</span>
          {player.cash_out !== null && (
            <span className="text-gray-400 text-sm">Out: ${player.cash_out}</span>
          )}
          <span className="text-gray-600 text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-800 px-4 py-3 space-y-4">
          {/* Buy-ins */}
          <div>
            <p className="text-gray-400 text-xs mb-2 uppercase tracking-wide">Buy-ins</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {(player.buy_ins ?? []).map((b, i) => (
                <span
                  key={i}
                  className="bg-gray-800 text-gray-200 text-sm px-3 py-1 rounded-full flex items-center gap-1"
                >
                  ${b}
                  <button
                    onClick={() => onRemoveBuyIn(i)}
                    className="text-gray-500 hover:text-red-400 ml-1 leading-none"
                  >
                    ×
                  </button>
                </span>
              ))}
              {(player.buy_ins ?? []).length === 0 && (
                <span className="text-gray-600 text-sm">None yet</span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                step="any"
                value={buyInInput}
                onChange={(e) => setBuyInInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddBuyIn()}
                placeholder="Amount"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-green-500"
              />
              <button
                onClick={handleAddBuyIn}
                disabled={saving}
                className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm transition-colors"
              >
                + Buy in
              </button>
            </div>
          </div>

          {/* Cash out */}
          <div>
            <p className="text-gray-400 text-xs mb-2 uppercase tracking-wide">Cash out</p>
            {player.cash_out !== null ? (
              <div className="flex items-center gap-3">
                <span className="text-green-400 font-bold">${player.cash_out}</span>
                <button
                  onClick={onClearCashOut}
                  className="text-gray-500 hover:text-red-400 text-sm transition-colors"
                >
                  Edit
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={cashOutInput}
                  onChange={(e) => setCashOutInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSetCashOut()}
                  placeholder="Final chip count"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-green-500"
                />
                <button
                  onClick={handleSetCashOut}
                  disabled={saving}
                  className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Cash out
                </button>
              </div>
            )}
          </div>

          {/* Remove player */}
          <div className="pt-1">
            <button
              onClick={onRemove}
              className="text-gray-600 hover:text-red-400 text-xs transition-colors"
            >
              Remove player
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
