---
description: Run today's Spanish practice session — ten words, multiple choice
---

Run today's Spanish practice session.

1. Run `node src/cli.ts pick` to get today's ten questions as JSON.
2. Ask them with the **AskUserQuestion** tool in three rounds: 4, 4, then 2.
   Use each question's `prompt` as the question text and its `options` as the
   choices, in the order given. Never ask the user to type a Spanish word —
   clicking is the whole point of the format.
   - For `es->en` questions, header `Spanish → English`.
   - For `en->es` questions, header `English → Spanish`.
   - Put the word's `note` in the option description only *after* the round is
     scored, never as a hint inside the question itself.
3. After each round, tell the user which ones they got right and wrong, with
   the correct answer for any misses and any note worth knowing.
4. Record the results with
   `node src/cli.ts answer <id>:1 <id>:0 ...` — `1` for right, `0` for wrong,
   using the `word.id` from the JSON.
5. Finish with `node src/cli.ts stats` and a one-line read on how it went and
   what is coming back tomorrow.

Keep it brisk. This should take the user under two minutes.
