type SpeechRecInstance = {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}

type SpeechRecCtor = new () => SpeechRecInstance

function getSpeechRecognitionCtor(): SpeechRecCtor | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecCtor
    webkitSpeechRecognition?: SpeechRecCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

/** Cancel current speech. Call before starting a new utterance. */
export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel()
  }
}

function speakUtterance(text: string, lang: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      resolve()
      return
    }
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang
    u.onend = () => resolve()
    u.onerror = () => resolve()
    window.speechSynthesis.speak(u)
  })
}

/** Fire-and-forget English TTS (cancels previous). */
export function speakEnglish(text: string): void {
  void speakUtterance(text, 'en-US')
}

/** Fire-and-forget Russian TTS (cancels previous). */
export function speakRussian(text: string): void {
  void speakUtterance(text, 'ru-RU')
}

export function speakEnglishAsync(text: string): Promise<void> {
  return speakUtterance(text, 'en-US')
}

export function speakRussianAsync(text: string): Promise<void> {
  return speakUtterance(text, 'ru-RU')
}

export function isSpeechRecognitionAvailable(): boolean {
  return getSpeechRecognitionCtor() !== undefined
}

export function listenEnglish(maxMs = 15000): Promise<string> {
  const Ctor = getSpeechRecognitionCtor()

  if (!Ctor) {
    return Promise.reject(new Error('Распознавание речи недоступно'))
  }

  return new Promise((resolve, reject) => {
    const rec = new Ctor()
    rec.lang = 'en-US'
    rec.interimResults = false
    rec.maxAlternatives = 1

    let settled = false
    const settle = (fn: () => void) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      fn()
    }

    const timer = window.setTimeout(() => {
      try {
        rec.stop()
      } catch {
        /* ignore */
      }
      settle(() => reject(new Error('Таймаут записи')))
    }, maxMs)

    rec.onresult = (event: SpeechRecognitionEvent) => {
      const text = event.results[0]?.[0]?.transcript ?? ''
      settle(() => resolve(text.trim()))
    }

    rec.onerror = () => {
      settle(() => reject(new Error('Ошибка распознавания')))
    }

    rec.onend = () => {
      settle(() => reject(new Error('Нет результата')))
    }

    try {
      rec.start()
    } catch (e) {
      settle(() => reject(e instanceof Error ? e : new Error(String(e))))
    }
  })
}
