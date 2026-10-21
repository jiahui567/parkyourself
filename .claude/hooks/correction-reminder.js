// UserPromptSubmit hook: when the user's message looks like a correction or a
// lasting rule, reminds Claude to record it with the capture-lesson skill.
// Plain stdout from this hook is added to Claude's context.

const CORRECTION =
  /\b(wrong|incorrect|not what i|that'?s not|not like that|don'?t|do not|never|always|instead|should(n'?t)? (have|be|use)|why did you|you forgot|you missed|revert|undo|stop|salah|jangan|bukan|tak betul)\b/i;

let input = '';
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  const prompt = JSON.parse(input || '{}').prompt ?? '';
  if (CORRECTION.test(prompt)) {
    process.stdout.write(
      'Reminder: if this message corrects your earlier work or states a lasting rule for this project, ' +
        'run the capture-lesson skill before continuing. If it is only a choice for the current task, ignore this.\n'
    );
  }
  process.exit(0);
});
