# AI Travel Agent (Claude Hackathon Berlin)

A conversational travel agent web app. It interviews the user (trip style, budget,
origin, destination or "suggest", dates/duration, travelers), proposes a day-by-day
itinerary with live weather and flight/hotel prices, and books (simulated) only
after the human confirms.

## Stack
- Next.js (App Router, TypeScript) + Tailwind + `@anthropic-ai/sdk`
- Model: `claude-sonnet-5-5`
- Weather: Open-Meteo (no key). Flights/hotels: SerpApi if `SERPAPI_KEY` is set, else mock JSON.
- Secrets in `.env.local` (`ANTHROPIC_API_KEY`, optional `SERPAPI_KEY`). Never commit them.

## How we work
- Propose a short plan before writing code; build in tiers
  (Tier 1 working agent → Tier 2 booking → Tier 3 live prices). Don't start a tier
  until the previous one works end to end.
- One task per session.
- Run `npm run dev` and walk through the demo scenario after each step.

## Agent-building principles
- Write the agent loop by hand with the Claude API; no agent framework.
- Keep the system prompt short: role, goal, boundaries, output format.
- Trim tool results to the fields the model needs before adding them to context.
- When a tool fails: catch the error, send a one-line summary to the model,
  stop after 3 consecutive failures and tell the user.
- Every provider (`lib/providers/*`) falls back to mock data on a missing key or any
  error. The demo must never break because an API fails.
- Human-in-the-loop is enforced in code: `book_trip` is only in the tools list when
  the request has `confirmed: true`. Booking is simulated; no real payments.
- The itinerary comes from the `propose_trip` tool as structured JSON and is rendered
  as cards. Never parse markdown for it.
- Save the conversation (messages list) per session ID after every step so it can
  resume.
