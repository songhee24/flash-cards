export interface Card {
  id: string
  ru: string
  en: string
  createdAt: number
}

export interface ExportPayload {
  version: number
  exportedAt: string
  cards: Card[]
}

export interface SessionPrefs {
  /** Seconds before the English answer is shown automatically (0 = off). */
  hintDelaySec: number
  /** After Correct/Wrong, wait this many seconds before the next card. */
  betweenCardsDelaySec: number
  /** Randomize card order each session. */
  shuffle: boolean
  /** Offer microphone input when the browser supports it. */
  preferVoiceInput: boolean
}
