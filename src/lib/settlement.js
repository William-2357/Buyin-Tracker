/**
 * Greedy settlement algorithm.
 * Minimizes number of transactions to settle all debts.
 *
 * @param {Array<{name: string, net: number}>} players
 * @returns {Array<{from: string, to: string, amount: number}>}
 */
export function calculateSettlement(players) {
  const creditors = []
  const debtors = []

  for (const p of players) {
    const rounded = Math.round(p.net * 100) / 100
    if (rounded > 0) creditors.push({ name: p.name, amount: rounded })
    else if (rounded < 0) debtors.push({ name: p.name, amount: -rounded })
  }

  creditors.sort((a, b) => b.amount - a.amount)
  debtors.sort((a, b) => b.amount - a.amount)

  const transactions = []
  let ci = 0
  let di = 0

  while (ci < creditors.length && di < debtors.length) {
    const credit = creditors[ci]
    const debt = debtors[di]
    const transfer = Math.min(credit.amount, debt.amount)

    if (transfer > 0.005) {
      transactions.push({
        from: debt.name,
        to: credit.name,
        amount: Math.round(transfer * 100) / 100,
      })
    }

    credit.amount = Math.round((credit.amount - transfer) * 100) / 100
    debt.amount = Math.round((debt.amount - transfer) * 100) / 100

    if (credit.amount < 0.005) ci++
    if (debt.amount < 0.005) di++
  }

  return transactions
}

/**
 * Mode 1: Deduct missing amount proportionally from winners.
 *
 * @param {Array<{name: string, net: number}>} players
 * @param {number} missingAmount
 * @returns {Array<{name: string, net: number}>}
 */
export function adjustProportional(players, missingAmount) {
  if (!missingAmount || missingAmount <= 0) return players

  const winners = players.filter((p) => p.net > 0)
  const totalWinnings = winners.reduce((s, p) => s + p.net, 0)
  if (totalWinnings <= 0) return players

  return players.map((p) => {
    if (p.net <= 0) return p
    const share = (p.net / totalWinnings) * missingAmount
    return { ...p, net: Math.round((p.net - share) * 100) / 100 }
  })
}

/**
 * Mode 2: Floor all winners' nets to whole dollars.
 * Losers are also floored (ceiling their loss) so they pay whole dollars.
 * Any remaining cents just disappear (house keeps them).
 *
 * @param {Array<{name: string, net: number}>} players
 * @returns {Array<{name: string, net: number}>}
 */
export function adjustTruncate(players) {
  return players.map((p) => ({
    ...p,
    net: p.net >= 0 ? Math.floor(p.net) : -Math.floor(Math.abs(p.net)),
  }))
}
