---
name: capture-lesson
description: Use immediately whenever the user corrects your work, rejects an approach, says something is wrong or not what they asked, or states a lasting rule for this project ("don't...", "always...", "use X, not Y"). Records the lesson in the right skill, subagent or AGENTS.md so later sessions do not repeat the mistake. Run it before continuing the task.
---

# Capture a lesson

The user's corrections are how this project's instructions improve. Record them as they happen; the user should never have to ask.

1. **Is it lasting?** A rule about how this project is built, designed, tested or worked on: record it. A one-off choice for the current task ("call this button Next"): just do it, do not record. Unsure: ask the user in one line.
2. **Where does it go?**

   | Lesson about | Write it in |
   |---|---|
   | How screens look, are laid out or worded | `.claude/skills/add-screen/SKILL.md`, in the design standard |
   | Schema and migrations | `.claude/skills/add-migration/SKILL.md` |
   | Planning, milestone workflow, verifying | `.claude/skills/next-milestone/SKILL.md` |
   | What a review should catch | `.claude/agents/reviewer.md` |
   | How tests should be written | `.claude/agents/test-writer.md` |
   | Anything else | `AGENTS.md`, section "Lessons" |

3. **Write it** as one or two lines in the matching section: the rule, then the reason, with the date.
   `- 2026-10-21: Use X, not Y, because Z.`
   If a line already says something similar, sharpen that line instead of adding another. If the lesson contradicts an existing rule, replace the rule.
4. If the lesson changes a fact in PLAN.md or README.md, update that too.
5. **Tell the user** in one line what you recorded and where, then carry on with the task.
6. Do not commit; the change goes in with the user's next commit.

If the same rule keeps being broken, suggest turning it into a test or a hook, which cannot be skipped.
