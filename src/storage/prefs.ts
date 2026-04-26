import type { SessionPrefs } from '../types'

const PREFS_KEY = 'flash-cards-prefs'

export const DEFAULT_PREFS: SessionPrefs = {
  hintDelaySec: 0,
  betweenCardsDelaySec: 2,
  shuffle: true,
  preferVoiceInput: true,
  autoSpeakRuQuestion: true,
  autoAdvanceAfterCheck: true,
  autoStartSttAfterRu: false,
}

export function loadPrefs(): SessionPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return { ...DEFAULT_PREFS }
    const p = JSON.parse(raw) as Partial<SessionPrefs>
    return {
      ...DEFAULT_PREFS,
      ...p,
      hintDelaySec: clampNum(p.hintDelaySec, 0, 120, DEFAULT_PREFS.hintDelaySec),
      betweenCardsDelaySec: clampNum(
        p.betweenCardsDelaySec,
        0,
        60,
        DEFAULT_PREFS.betweenCardsDelaySec,
      ),
      shuffle: typeof p.shuffle === 'boolean' ? p.shuffle : DEFAULT_PREFS.shuffle,
      preferVoiceInput:
        typeof p.preferVoiceInput === 'boolean'
          ? p.preferVoiceInput
          : DEFAULT_PREFS.preferVoiceInput,
      autoSpeakRuQuestion:
        typeof p.autoSpeakRuQuestion === 'boolean'
          ? p.autoSpeakRuQuestion
          : DEFAULT_PREFS.autoSpeakRuQuestion,
      autoAdvanceAfterCheck:
        typeof p.autoAdvanceAfterCheck === 'boolean'
          ? p.autoAdvanceAfterCheck
          : DEFAULT_PREFS.autoAdvanceAfterCheck,
      autoStartSttAfterRu:
        typeof p.autoStartSttAfterRu === 'boolean'
          ? p.autoStartSttAfterRu
          : DEFAULT_PREFS.autoStartSttAfterRu,
    }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

export function savePrefs(prefs: SessionPrefs): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
}

function clampNum(
  v: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof v !== 'number' || Number.isNaN(v)) return fallback
  return Math.min(max, Math.max(min, v))
}
