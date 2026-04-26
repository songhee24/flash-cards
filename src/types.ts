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
  /** Seconds before the English answer is shown automatically (0 = off). Ignored in voice-primary mode (STT on). */
  hintDelaySec: number
  /** After check, wait this many seconds before the next card. */
  betweenCardsDelaySec: number
  /** Randomize card order each session. */
  shuffle: boolean
  /** Prefer voice answer flow when SpeechRecognition is available. */
  preferVoiceInput: boolean
  /** Speak the Russian prompt when a new card appears. */
  autoSpeakRuQuestion: boolean
  /** After evaluation, speak English answer then auto-advance (no manual Correct/Wrong). */
  autoAdvanceAfterCheck: boolean
  /** After Russian TTS ends, start listening for English (voice-primary only). */
  autoStartSttAfterRu: boolean
}
