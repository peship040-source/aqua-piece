# Aqua Piece

A standalone, mobile-first match-three puzzle built with Vite, React, and TypeScript.

## Run locally

```sh
npm install
npm run dev
```

Use `npm test` to run the Vitest suite and `npm run build` to type-check the project and create a production build in `dist/`.

## Phase 1

Stage 1 gives you 30 moves to score 1,000 points. Tap two adjacent pieces to swap. A swap that makes no match or activates no special is reversed for free. Pieces fall into cleared spaces, and each automatic chain step multiplies the score for that step by its chain number. A board with no legal moves reshuffles while preserving your score and moves.

- Four in a line creates a LINE piece that clears along the match direction.
- Five in a line creates a COLOR piece. Swap it to clear the other piece's color. If another clear triggers it, it clears its own color.
- An L or T match creates a BURST piece that clears the surrounding 3×3 area.

The browser resumes your saved board and keeps your best score on this device. **Restart** replays the current seed. **New Game** uses a fresh seed. Both keep your best score.

## Future phases

Stage selection, additional stages, My Ocean, the collection (図鑑), seaglass rewards, obstacles, sound, accounts and sync, and GAME ARCADE integration are outside Phase 1.
