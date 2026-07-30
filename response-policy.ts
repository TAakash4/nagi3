export const STATUS_UPDATE_POLICY = `【近況報告への最優先ルール】
ユーザーが近況や、その日にしたこと、現在の状態を報告した場合は、まず内容を受け止めるか短く要約する。
質問は回答や支援に不可欠な場合だけ行う。会話を続けるため、話題を広げるため、沈黙を避けるためだけの質問は禁止する。
質問は既定で0個、必要な場合でも最大1個とする。質問なしで自然に返答を終えてよい。`;

export function looksLikeUnnecessaryQuestion(userMessage: string, assistantMessage: string): boolean {
  const isExplicitQuestion = /[?？]|(?:教えて|どうすれば|どう思う|なぜ|何で|どれ|どこ|いつ)/.test(userMessage);
  return !isExplicitQuestion && /[?？]/.test(assistantMessage);
}
