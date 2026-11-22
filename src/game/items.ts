export type ItemDef = { id: string; stageId: number; name: string; flavor: string }

export const ITEMS: ItemDef[] = [
  { id: 'seaglass-green', stageId: 1, name: 'みどりのシーグラス', flavor: '波にみがかれた、やさしい緑のガラスのかけら。' },
  { id: 'coral-shell', stageId: 2, name: 'まきがい', flavor: '耳をよせると、遠い海の音がする気がする。' },
  { id: 'starfish', stageId: 3, name: 'ヒトデ', flavor: '岩場の人気者。五つの腕でのんびり日向ぼっこ。' },
  { id: 'seaglass-blue', stageId: 4, name: 'あおいシーグラス', flavor: '深い青。長い旅をしてきたガラスのしずく。' },
  { id: 'pearl-oyster', stageId: 5, name: 'しんじゅ貝', flavor: '中に小さな真珠をひとつ、隠し持っている。' },
  { id: 'seahorse', stageId: 6, name: 'タツノオトシゴ', flavor: '海藻につかまって、ゆらゆら揺れている。' },
  { id: 'jellyfish', stageId: 7, name: 'クラゲ', flavor: '触手が光る、夜の海のランプ。' },
  { id: 'coral-piece', stageId: 8, name: 'サンゴのかけら', flavor: 'ピンクの枝サンゴ。魚たちの隠れ家だったもの。' },
  { id: 'tropical-fish', stageId: 9, name: 'トロピカルフィッシュ', flavor: '黄色と青の小さな魚。サンゴの周りが大好き。' },
  { id: 'sea-turtle', stageId: 10, name: 'ウミガメ', flavor: '何十年も海を旅する、大きな先輩。' },
]

export function itemForStage(stageId: number): ItemDef | undefined {
  return ITEMS.find(item => item.stageId === stageId)
}
