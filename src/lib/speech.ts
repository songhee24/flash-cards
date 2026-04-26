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

export function speakEnglish(text: string): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'en-US'
  window.speechSynthesis.speak(u)
}

export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel()
  }
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
