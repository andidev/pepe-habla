# Pepe Habla

A Spanish vocabulary trainer for iOS, Android and web, named after Pepe, a
street dog from Mexico City who is the mascot. Expo app in `apps/app`, pure
logic in `packages/core`.

## The learners

- **Mexican Spanish**: `carro` not `coche`, `computadora` not `ordenador`, no
  `vosotros`. Flag Spain differences only when worth knowing.
- App languages: Svenska, English, Español. Anders learns in English or
  Swedish; his son learns in Swedish.
- **Every answer is a tap. Never make the learner type.**
- Anders reviews content by playing the app, not by reading drafts. Ship on
  your draft; fix the seed when he reports something.

## Rules that are not negotiable

- **`packages/core` imports nothing from `node:`, `react` or `react-native`**
  and touches no filesystem. `noNodeImports.test.ts` enforces it. This is what
  keeps the web build cheap.
- Randomness is injected as an `Rng` parameter; core never calls `Math.random()`.
- Relative imports in core carry explicit `.ts` extensions (Node 24 runs TS
  directly — there is no build step).
- Only `apps/app/components/Screen.tsx`, `apps/app/feedback.ts` and
  `apps/app/notifications.ts` may branch on platform or touch device APIs.
  (`apps/app/app/session.tsx` also imports `AppState`, to persist a round
  backgrounded mid-session — a pre-existing exception, not a new one to copy.)
- Palette only through `apps/app/theme.ts`. 2px ink borders, hard offset
  shadows, never blurred. Touch targets ≥ 44px. Interface copy goes through
  `apps/app/i18n/strings.ts`.
- A repair answer is never recorded. Only the first tap on a question counts.
- Never speak a language with another language's voice — silence instead.
- No bundled pronunciation recordings: the macOS voices are licensed for
  personal use only. Speech comes from the device.

## Working in this repo

- **Stage files by name. Never `git add -A`** — other sessions commit here
  too, and broad adds have swept unrelated work into commits.
- **Never run `expo run:ios`, `expo run:android` or `expo prebuild`, and never
  edit `package.json` scripts or `app.json` to verify something.** Agents have
  stalled for over an hour on native builds. Verify in Expo Go:
  `npx expo start` in `apps/app`, then open `exp://127.0.0.1:8081`.
- Read `apps/app/AGENTS.md`: consult the Expo SDK 57 docs before app code.
- `npm test` (node:test) and `npm run typecheck` (root and app) from the root.

## Where things are

- Specs: `docs/superpowers/specs/`. The current direction is the newest ones —
  `2026-09-21-levels-and-tracks-design.md` amends the original design.
- Plans and each finished plan's execution log (every ruling and deferred
  finding): `docs/superpowers/plans/`.
