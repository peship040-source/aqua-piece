# AQUA PIECE — Phase 2 notes

## Owner playtest feedback (2026-11-22, Phase 1 widget build)
- Core operation itself is fine ("動作自体はまぁ、いい").
- BUT: no sense of tiles actually falling — wants a visible falling/gravity feel.
- Visuals are far from his image: no sea feeling, screen looks cheap.
- Wants a proper "game app" feel overall.
- Phase 1 accepted as a touch-and-try prototype ("触ってみるはできたからよし").

## Phase 2 direction (visual / animation upgrade, engine logic unchanged)
1. Falling animation: tiles animate downward with easing when gravity applies; new tiles drop in from above; clear = pop/shrink effect; chain indicator and floating score popups.
2. Sea theme: deep-sea gradient background, light rays, drifting bubbles; tiles as translucent seaglass gems (glossy highlight, rounded, soft shadow); board as a glass/sand framed panel.
3. Game-app feel: HUD as designed cards (goal progress bar, moves badge), selection glow/bounce, win/lose result modal, styled buttons, tile swap animation.
- Keep `src/game/` engine pure and untouched in behaviour; implement animation in the UI layer (track tile identity/position across resolve steps).
- Verify with npm test + build as before, then refresh the in-chat playable widget.

## Owner playtest feedback — Phase 2 (2026-11-22)
- Falling animation: acceptable ("落ち方はまぁいいかも").
- The remaining problem is the VISUALS, exactly as 雫 predicted: CSS-drawn tiles hit a quality ceiling.
- **Sound is NOT wanted** (owner, 2026-11-22 「音声はいらないよー」). Do not add audio.
- Owner notes he asked at the start whether this stack was really enough because of this visual ceiling — acknowledged: the stack is sufficient for mechanics, but CSS-only art is the limiting factor.
- Phase 3 direction (owner decision, 2026-11-22 「Canvas/WebGL系の描画ライブラリ（PixiJSとか）これ最初からいれて、見た目は大事だよ」): adopt PixiJS as the board renderer from now on — do not build more content on DOM/CSS rendering. Keep the web stack and the pure TS engine; React stays for HUD/menus/modals. Generated image assets for gems/background can be layered on Pixi textures afterwards. A full engine (Unity/Godot) stays out of scope unless the target changes to native/3D.
