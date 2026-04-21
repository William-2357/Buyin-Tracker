# Poker Buyin Tracker

Hello

A mobile-friendly web app for tracking poker sessions and settling payments between players. One person runs the app as host — no accounts needed for individual players.

## Features

- **Session tracking** — create a session, add players by name, record multiple buy-ins and a final cash-out per player
- **Automatic settlement** — greedy algorithm that minimizes the number of transactions needed to settle all debts
- **Missing money handling** — if the pot doesn't balance, deduct the difference proportionally from winners
- **Lifetime stats** — track total buy-ins and net profit/loss per player across all sessions
- **Cross-session player registry** — players are recognized by name across sessions so lifetime stats accumulate automatically

## Tech Stack

| Layer              | Technology                                                       |
| ------------------ | ---------------------------------------------------------------- |
| Frontend           | [React 19](https://react.dev)                                    |
| Routing            | [React Router v7](https://reactrouter.com)                       |
| Styling            | [Tailwind CSS v4](https://tailwindcss.com)                       |
| Build tool         | [Vite](https://vite.dev)                                         |
| Backend / Database | [Supabase](https://supabase.com) (Postgres + Row Level Security) |
| Auth               | Supabase Auth (email/password)                                   |
| Hosting            | [Vercel](https://vercel.com)                                     |

## Project Structure

```
src/
  App.jsx                 # Routes and auth guards
  context/
    AuthContext.jsx       # Auth state, sign up/in/out
  lib/
    supabase.js           # Supabase client
    settlement.js         # Settlement and missing money algorithms
  pages/
    Login.jsx             # Sign in
    Signup.jsx            # Create account
    Home.jsx              # Session list
    Session.jsx           # Session detail — players, buy-ins, cash-out, settlement
    Stats.jsx             # Lifetime stats per player
  components/
    Layout.jsx            # Header and bottom nav
supabase_schema.sql       # Full database schema with RLS policies
```

## Data Model

```
profiles        — host accounts (id, name, email)
players         — global player registry by name (id, name)
sessions        — a single poker session (id, created_by, date)
player_sessions — a player's record in a session (player_id, session_id, buy_ins[], cash_out)
```

## Local Setup

**1. Clone and install**

```bash
git clone https://github.com/William-2357/Poker-Buyin-Tracker.git
cd Poker-Buyin-Tracker
npm install
```

**2. Create a Supabase project** at [supabase.com](https://supabase.com), then run `supabase_schema.sql` in the SQL Editor.

**3. Add environment variables** — create `.env.local` in the project root:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_publishable_key
```

Find these in your Supabase project under **Settings → API**.

**4. Run the dev server**

```bash
npm run dev
```

## Deployment (Vercel)

1. Push the repo to GitHub
2. Import the project in [Vercel](https://vercel.com) and set the framework to **Vite**
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under **Settings → Environment Variables**
4. Deploy — every push to `main` will auto-deploy

## Settlement Algorithm

At the end of a session, each player's net is calculated:

```
net = cash_out - total_buy_ins
```

Players with a positive net are creditors; negative net are debtors. The greedy algorithm repeatedly matches the largest debtor with the largest creditor, transferring the minimum of the two amounts, until all balances are zero. This minimizes the total number of transactions.

If money is missing from the pot, the host can enter the missing amount and it will be deducted proportionally from all players who finished with a positive net.
