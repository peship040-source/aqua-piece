# AQUA PIECE — Phase 1 spec (director: 雫, approved by owner 2026-11-22)

Standalone project (IROUM方式): no auth, no backend/Supabase, on-device save only.
Stack: Vite + React + TypeScript, Vitest for unit tests.

## Phase 1 scope (only this)
Playable match-3 core + Stage 1:
- Board 8x8, 6 tile types. Each type has a distinct color AND symbol/shape (colorblind-safe).
- Seeded RNG. Initial board: no pre-existing matches, at least one valid move.
- Swap adjacent tiles (tap-tap). Invalid swap reverts and costs no move.
- Match 3+ clears; gravity + refill; automatic chains. Score per clear step = tilesCleared x 10 x chainIndex (chain starts at 1).
- Special tiles: 4-in-line -> LINE (clears its row or column), 5-in-line -> COLOR (clears all of one color), L/T shape -> BURST (clears 3x3 around). Created tile replaces at swap origin when determinable. Specials trigger when swapped or caught in a clear. Priority when multiple: COLOR > BURST > LINE.
- No valid moves -> reshuffle preserving moves/score.
- Stage 1: 30 moves, score goal 1000. Win when goal reached; lose when moves run out below goal. Restart button. Result display.
- Save (localStorage, key `aqua-piece-v1`, versioned object): in-progress board/moves/score/goal + best score. Load on start if present ("continue"). Never crash on corrupt save.
- UI: minimal, mobile-first (max-width ~480px), HUD = goal / moves left / score / chain indicator, board grid, result banner, restart + new-game buttons. Sea/seaglass color palette, readability first.

## Out of scope (Phase 2+, do NOT build)
20 stages, stage select, My Ocean, collection/図鑑, seaglass rewards, obstacles, sound, accounts/sync, GAME ARCADE integration.

## Engineering rules
- Pure game engine in `src/game/` (no React/DOM imports): board gen, match find, resolve/chain, specials, reshuffle, win/lose. RNG injectable for tests.
- Unit tests in `src/game/*.test.ts` covering: board gen invariants, invalid swap, match+gravity+chain scoring, each special creation, reshuffle, win/lose.
- `npm test` and `npm run build` must pass.
- README.md: what this is, how to run, Phase 1 scope, what is not built yet.
- No new paid services, no analytics, no external network calls.
