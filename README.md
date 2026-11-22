# AQUA PIECE

海をテーマにした、単体で遊べるマッチ3パズル。Vite + React + TypeScript で作り、盤面の描画は PixiJS (WebGL)、保存は端末ローカル（アカウントなし）。

## v1.0 の内容

- ステージ1：30手で1,000点が目標。タップ×2で隣接交換（無効な交換は手数消費なしで戻る）
- マッチ→消去→落下→連鎖をステップ再生するアニメーション（PixiJS / Ticker）
- 特殊石：4直線=LINE、5直線=COLOR、L/T字=BURST
- 手詰まり時は自動シャッフル。スコアは 消去数×10×連鎖数
- 石はシーグラスの画像素材6種（色＋形で判別）、背景は海のアート、消去で泡パーティクル、タップで波紋
- 進行中ゲームとベストスコアを localStorage に保存（キー `aqua-piece-v1`）
- 音なし（仕様）

## 開発

```sh
npm install
npm run dev     # 開発サーバー
npm test        # Vitest（エンジン＋アニメーション）
npm run build   # 型チェック＋本番ビルド（dist/）
```

試遊ウィジェット用ビルドは `vite.widget.config.ts`（単一ファイル出力）を使う。

## 構成

- `src/game/` — 純粋TypeScriptのゲームエンジン（盤面・判定・ステップ生成）。描画に依存しない
- `src/pixi/` — PixiJS描画とステップ再生、テクスチャ提供（画像素材は `src/assets/`）
- `src/main.tsx` / `src/styles.css` — HUD・モーダル等のReact側UI

## v1.0 の外（今後）

残り19ステージとステージ選択、シーグラス報酬と図鑑、マイオーシャン簡易版、障害物、GAME ARCADE接続、アカウント/同期。
