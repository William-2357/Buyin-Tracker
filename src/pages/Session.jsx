import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { calculateSettlement, adjustProportional, adjustTruncate } from '../lib/settlement'
import Layout from '../components/Layout'

export default function Session() {
  const { id } = useParams()

  const [session, setSession] = useState(null)
  const [players, setPlayers] = useState([]) // joined: player_sessions + players.name
  const [loading, setLoading] = useState(true)

  const [newName, setNewName] = useState('')
  const [addingPlayer, setAddingPlayer] = useState(false)
  const [addError, setAddError] = useState('')

  // Settlement adjustment
  const [adjustMode, setAdjustMode] = useState('proportional') // 'proportional' | 'truncate'
  const [missingInput, setMissingInput] = useState('')

  useEffect(() => {
    fetchAll()
  }, [id])

  async function fetchAll() {
    setLoading(true)
    const [{ data: sess }, { data: ps }] = await Promise.all([
      supabase.from('sessions').select('*').eq('id', id).single(),
      supabase
        .from('player_sessions')
        .select('*, players(id, name)')
        .eq('session_id', id)
        .order('created_at'),
    ])
    setSession(sess)
    setPlayers(ps ?? [])
    setLoading(false)
  }

  async function getOrCreatePlayer(name) {
    // Try to find existing player (case-insensitive)
    const { data: existing } = await supabase
      .from('players')
      .select('id, name')
      .ilike('name', name.trim())
      .maybeSingle()

    if (existing) return existing

    // Create new global player
    const { data: created, error } = await supabase
      .from('players')
      .insert({ name: name.trim() })
      .select()
      .single()

    if (error) throw error
    return created
  }

  async function addPlayer() {
    const name = newName.trim()
    if (!name) return
    setAddingPlayer(true)
    setAddError('')

    try {
      // Check if already in this session
      const already = players.some(
        (p) => p.players?.name?.toLowerCase() === name.toLowerCase()
      )
      if (already) {
        setAddError(`${name} is already in this session.`)
        setAddingPlayer(false)
        return
      }

      const player = await getOrCreatePlayer(name)

      const { error } = await supabase.from('player_sessions').insert({
        session_id: id,
        player_id: player.id,
        buy_ins: [],
        cash_out: null,
      })

      if (error) throw error
      setNewName('')
      await fetchAll()
    } catch (err) {
      setAddError(err.message)
    }

    setAddingPlayer(false)
  }

  async function removePlayer(psId) {
    await supabase.from('player_sessions').delete().eq('id', psId)
    await fetchAll()
  }

  async function addBuyIn(ps, amount) {
    const newBuyIns = [...(ps.buy_ins ?? []), amount]
    await supabase.from('player_sessions').update({ buy_ins: newBuyIns }).eq('id', ps.id)
    await fetchAll()
  }

  async function removeBuyIn(ps, index) {
    const newBuyIns = ps.buy_ins.filter((_, i) => i !== index)
    await supabase.from('player_sessions').update({ buy_ins: newBuyIns }).eq('id', ps.id)
    await fetchAll()
  }

  async function setCashOut(ps, amount) {
    await supabase.from('player_sessions').update({ cash_out: amount }).eq('id', ps.id)
    await fetchAll()
  }

  async function clearCashOut(ps) {
    await supabase.from('player_sessions').update({ cash_out: null }).eq('id', ps.id)
    await fetchAll()
  }

  if (loading) {
    return <Layout><div className="text-center text-gray-500 py-16">Loading…</div></Layout>
  }

  if (!session) {
    return <Layout><div className="text-center text-gray-400 py-16">Session not found.</div></Layout>
  }

  const allSettled = players.length > 0 && players.every((p) => p.cash_out !== null)

  const playerNets = players.map((ps) => ({
    name: ps.players?.name ?? 'Unknown',
    net: (ps.cash_out ?? 0) - (ps.buy_ins ?? []).reduce((s, v) => s + v, 0),
    totalBuyIn: (ps.buy_ins ?? []).reduce((s, v) => s + v, 0),
  }))

  const potTotal = playerNets.reduce((s, p) => s + p.totalBuyIn, 0)
  const cashOutTotal = players.reduce((s, p) => s + (p.cash_out ?? 0), 0)
  const diff = potTotal - cashOutTotal // positive = missing, negative = extra

  const missingAmt = parseFloat(missingInput) || 0
  const adjustedNets =
    adjustMode === 'truncate'
      ? adjustTruncate(playerNets)
      : adjustProportional(playerNets, missingAmt)

  const transactions = allSettled ? calculateSettlement(adjustedNets) : []

  return (
    <Layout>
      <div className="space-y-6 pb-8">
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
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => { setNewName(e.target.value); setAddError('') }}
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
          {addError && <p className="text-red-400 text-xs">{addError}</p>}
        </div>

        {/* Player cards */}
        {players.length === 0 ? (
          <div className="text-center py-12 text-gray-500">Add players above to get started.</div>
        ) : (
          <div className="space-y-3">
            {players.map((ps) => (
              <PlayerCard
                key={ps.id}
                ps={ps}
                name={ps.players?.name ?? 'Unknown'}
                onAddBuyIn={(amt) => addBuyIn(ps, amt)}
                onRemoveBuyIn={(i) => removeBuyIn(ps, i)}
                onSetCashOut={(amt) => setCashOut(ps, amt)}
                onClearCashOut={() => clearCashOut(ps)}
                onRemove={() => removePlayer(ps.id)}
              />
            ))}
          </div>
        )}

        {/* Settlement */}
        {allSettled && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-white font-semibold">Settlement</h3>
              <span className="text-xs text-gray-500">
                Pot ${potTotal} · Out ${cashOutTotal}
                {diff !== 0 && (
                  <span className={diff > 0 ? ' text-yellow-500' : ' text-blue-400'}>
                    {' '}({diff > 0 ? `-$${diff.toFixed(2)}` : `+$${Math.abs(diff).toFixed(2)}`})
                  </span>
                )}
              </span>
            </div>

            {/* Adjustment controls */}
            {diff !== 0 && (
              <div className="px-4 py-3 border-b border-gray-800 bg-gray-800/40 space-y-3">
                <p className="text-yellow-400 text-xs font-medium">
                  ⚠ ${Math.abs(diff).toFixed(2)} {diff > 0 ? 'missing from' : 'extra in'} pot — choose how to settle:
                </p>

                {/* Mode toggle */}
                <div className="flex rounded-lg overflow-hidden border border-gray-700 text-sm">
                  <button
                    onClick={() => setAdjustMode('proportional')}
                    className={`flex-1 py-1.5 transition-colors ${
                      adjustMode === 'proportional'
                        ? 'bg-green-700 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    % from winners
                  </button>
                  <button
                    onClick={() => setAdjustMode('truncate')}
                    className={`flex-1 py-1.5 transition-colors ${
                      adjustMode === 'truncate'
                        ? 'bg-green-700 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Truncate to $1
                  </button>
                </div>

                {adjustMode === 'proportional' && (
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={missingInput}
                      onChange={(e) => setMissingInput(e.target.value)}
                      placeholder={`Missing amount (e.g. ${Math.abs(diff).toFixed(2)})`}
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-green-500"
                    />
                    <button
                      onClick={() => setMissingInput(String(Math.abs(diff).toFixed(2)))}
                      className="text-green-400 hover:text-green-300 text-xs px-3 border border-gray-600 rounded-lg transition-colors whitespace-nowrap"
                    >
                      Auto-fill
                    </button>
                  </div>
                )}

                {adjustMode === 'truncate' && (
                  <p className="text-gray-400 text-xs">
                    Everyone's winnings/losses are rounded to whole dollars. Leftover cents go to the house.
                  </p>
                )}
              </div>
            )}

            {/* Net summary per player */}
            <div className="divide-y divide-gray-800/60">
              {adjustedNets.map((p, i) => {
                const netColor = p.net > 0 ? 'text-green-400' : p.net < 0 ? 'text-red-400' : 'text-gray-500'
                return (
                  <div key={i} className="px-4 py-2 flex justify-between text-sm">
                    <span className="text-gray-300">{p.name}</span>
                    <span className={`font-medium ${netColor}`}>
                      {p.net >= 0 ? '+' : ''}${p.net.toFixed(2)}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Transactions */}
            <div className="border-t border-gray-800">
              {transactions.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-5">All square! 🎉</p>
              ) : (
                <div className="divide-y divide-gray-800/60">
                  {transactions.map((t, i) => (
                    <div key={i} className="px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-red-400 font-medium">{t.from}</span>
                        <span className="text-gray-600">→</span>
                        <span className="text-green-400 font-medium">{t.to}</span>
                      </div>
                      <span className="text-white font-bold">${t.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
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

function PlayerCard({ ps, name, onAddBuyIn, onRemoveBuyIn, onSetCashOut, onClearCashOut, onRemove }) {
  const [buyInInput, setBuyInInput] = useState('')
  const [cashOutInput, setCashOutInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(true)

  const totalBuyIn = (ps.buy_ins ?? []).reduce((s, v) => s + v, 0)
  const net = ps.cash_out !== null ? ps.cash_out - totalBuyIn : null
  const netColor = net === null ? '' : net >= 0 ? 'text-green-400' : 'text-red-400'

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
      <div
        className="px-4 py-3 flex items-center justify-between cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <span className="text-white font-semibold">{name}</span>
          {net !== null && (
            <span className={`text-sm font-bold ${netColor}`}>
              {net >= 0 ? '+' : ''}${Math.abs(net).toFixed(2)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-500">In: ${totalBuyIn}</span>
          {ps.cash_out !== null && <span className="text-gray-400">Out: ${ps.cash_out}</span>}
          <span className="text-gray-600 text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-800 px-4 py-3 space-y-4">
          {/* Buy-ins */}
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">Buy-ins</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {(ps.buy_ins ?? []).map((b, i) => (
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
              {(ps.buy_ins ?? []).length === 0 && (
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
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">Cash out</p>
            {ps.cash_out !== null ? (
              <div className="flex items-center gap-3">
                <span className="text-green-400 font-bold">${ps.cash_out}</span>
                <button onClick={onClearCashOut} className="text-gray-500 hover:text-red-400 text-sm transition-colors">
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

          <button onClick={onRemove} className="text-gray-600 hover:text-red-400 text-xs transition-colors pt-1">
            Remove player
          </button>
        </div>
      )}
    </div>
  )
}
