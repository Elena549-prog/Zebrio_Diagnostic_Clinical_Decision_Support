# Context engineering learnings

Rules for building and working on this agent. Context engineering = deciding what
goes into the model's context window, in what form, and when, so the model has what
it needs and nothing that distracts it.

## Core ideas
- The LLM is stateless. The context is the only thing it knows; memory is our code
  re-sending (or summarizing) the conversation. Cost grows with history.
- Give the model everything it needs and nothing it doesn't. Long contexts "rot":
  reasoning degrades, stale or irrelevant content distracts, tokens cost time and money.
- The LLM only outputs text/JSON. Our code does the work, so our code decides whether
  an action happens, how, and what the model hears back.
- Plain code for fixed steps, LLM only where judgment is needed. Fully free agents get
  unreliable over many steps.

## Agent loop and context
- Hand-written loop with the plain SDK, no framework: call LLM -> pick tool -> run it
  -> append the (trimmed) result -> repeat. We must see every token we send.
- Trim tool results to the fields the model needs; stack traces become one line.
- Build the context deliberately: store everything, send selectively. Drop resolved
  errors and old drafts, label sections (XML-like tags work well with Claude), task
  first, question last. Start with the normal messages list plus trimming; write a
  full `build_context()` only if a long run starts confusing the model.

## Errors
- Never crash on a tool failure: catch it, add a one-line error written for the model
  ("date must be YYYY-MM-DD", not "invalid input"), let the model retry.
- Stop after 3 consecutive failures and escalate to the human.
- After success, drop the resolved error or reduce it to "succeeded after 1 retry".

## State, pause and resume
- Everything the agent knows lives in the messages list, so saving that list is saving
  the agent. Save it as JSON per session ID after every step; reload on startup.
- Use the same pause for human approval before risky actions (booking).

## System prompt
- Short: role, goal, boundaries, output format. Explain why instead of ALL-CAPS NEVER.
- Add 1-3 examples of ideal behavior. Start minimal, add one line per observed failure.
- Not 40 lines of "if X then exactly Y".

## MCP
- MCP standardizes how tools are packaged ("USB-C for AI"); the LLM still outputs JSON
  and code still does the work.
- Every connected server adds its tool descriptions to every call: connect only what
  the task needs, keep tool descriptions clear, keep a direct-API fallback for anything
  critical.
- Building our own MCP server for the planner is a bonus after the core agent works.

## Subagents
- A subagent has its own fresh context and returns only a short result. Use for noisy
  tasks with small answers, parallel independent work (e.g. one researcher per city),
  or a fresh-eyes reviewer. Skip for small or tightly coupled tasks.
- Start with one focused agent; add subagents only when one of those cases appears.

## Working with Claude Code
- Greenfield: write decisions down (CLAUDE.md, SPEC.md) so sessions don't drift.
- Keep a short SPEC.md; when a session gets messy, `/clear` and "continue from SPEC.md".
- One task per session. `/compact` when long, `/clear` when switching tasks.
- Keep decisions and their reasons, status, conventions and open problems. Let go of
  old chat, failed attempts and old code versions; the code is the source of truth.
- When results are bad, print the exact context sent before changing the model.
