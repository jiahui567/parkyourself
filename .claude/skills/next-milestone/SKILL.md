---
name: next-milestone
description: Use when the user asks to start, continue or finish a Park Yourself milestone (an M milestone for version 1, or a C milestone for version 2, in PLAN.md), or asks what to work on next.
---

# Work on a milestone

1. **Find it.** Read PLAN.md, section "Milestones": the milestone the user named, or the first one not ticked. Read README.md, section "Status", for parts already built ahead.
2. **Read the rules.** Read the PLAN.md sections the milestone touches. List anything the plan does not answer and ask the user before coding.
3. **Plan briefly.** Files to add or change, tests to add, and what can only be checked on the phone. A new dependency needs the user's yes first.
4. **Build in this order**, running tests as you go:
   1. Pure logic with Jest tests (`src/fees`, `src/text`, `src/zone`, `src/ocr`, `src/lib`).
   2. Schema changes (add-migration skill).
   3. Data functions in `src/db` with Node SQLite tests.
   4. Screens (add-screen skill).
5. **Verify.** Run `npm run lint` and `npm test`, then ask the `reviewer` subagent to review the change and fix what it finds. List what the user must check on the phone.
6. **Finish.** Update README.md "Status". Tick the milestone in PLAN.md only after the user confirms it works on the phone. Give the user the commit commands; do not commit unless asked.
   - 2026-10-26: When the user says they "tested everything", they mean they tried every UI action on the phone they could find: tick every milestone waiting for a phone check, except the server parts (sign-in, reports, sync), and ask only about those, because a narrower reading made them repeat themselves.
