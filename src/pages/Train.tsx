import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Card, SessionPrefs } from '../types'
import { getCardsSorted } from '../storage/db'
import { loadPrefs, savePrefs } from '../storage/prefs'
import { answersMatch } from '../lib/normalize'
import {
  isSpeechRecognitionAvailable,
  listenEnglish,
  speakEnglish,
  speakEnglishAsync,
  speakRussian,
  speakRussianAsync,
  stopSpeaking,
} from '../lib/speech'

type Phase = 'answer' | 'review'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function Train() {
  const [allCards, setAllCards] = useState<Card[]>([])
  const [queue, setQueue] = useState<Card[]>([])
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('answer')
  const [userAnswer, setUserAnswer] = useState('')
  const [hintShown, setHintShown] = useState(false)
  const [matchResult, setMatchResult] = useState<boolean | null>(null)
  const [prefs, setPrefs] = useState<SessionPrefs>(() => loadPrefs())
  const [loading, setLoading] = useState(true)
  const [sttLoading, setSttLoading] = useState(false)
  const [sttError, setSttError] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const speakGenRef = useRef(0)
  const cardRef = useRef<Card | null>(null)

  const voicePrimary =
    prefs.preferVoiceInput && isSpeechRecognitionAvailable()
  const textVoiceFallback =
    prefs.preferVoiceInput && !isSpeechRecognitionAvailable()
  const classicTyping = !prefs.preferVoiceInput

  const usable = useMemo(
    () => allCards.filter((c) => c.ru.trim() && c.en.trim()),
    [allCards],
  )

  const card = queue[index]

  useEffect(() => {
    cardRef.current = card
  }, [card])

  const initialHintShown = useCallback((p: SessionPrefs) => {
    const vp = p.preferVoiceInput && isSpeechRecognitionAvailable()
    return vp ? false : p.hintDelaySec <= 0
  }, [])

  const startSession = useCallback(
    (cards: Card[], p: SessionPrefs) => {
      const list = cards.filter((c) => c.ru.trim() && c.en.trim())
      const q = p.shuffle
        ? shuffle(list)
        : [...list].sort((a, b) => a.createdAt - b.createdAt)
      setQueue(q)
      setIndex(0)
      setPhase('answer')
      setUserAnswer('')
      setHintShown(initialHintShown(p))
      setMatchResult(null)
      setSttError(null)
    },
    [initialHintShown],
  )

  const reloadFromDb = useCallback(async () => {
    const cards = await getCardsSorted()
    setAllCards(cards)
    return cards
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        const cards = await reloadFromDb()
        const p = loadPrefs()
        setPrefs(p)
        startSession(cards, p)
      } finally {
        setLoading(false)
      }
    })()
  }, [reloadFromDb, startSession])

  useEffect(() => {
    if (hintTimerRef.current) {
      window.clearTimeout(hintTimerRef.current)
      hintTimerRef.current = null
    }
    if (phase !== 'answer' || !card || voicePrimary) return
    if (prefs.hintDelaySec <= 0) {
      queueMicrotask(() => setHintShown(true))
      return
    }
    queueMicrotask(() => setHintShown(false))
    hintTimerRef.current = window.setTimeout(() => {
      setHintShown(true)
    }, prefs.hintDelaySec * 1000)
    return () => {
      if (hintTimerRef.current) {
        window.clearTimeout(hintTimerRef.current)
        hintTimerRef.current = null
      }
    }
  }, [card, phase, prefs.hintDelaySec, voicePrimary])

  const persistPrefs = (next: SessionPrefs) => {
    setPrefs(next)
    savePrefs(next)
  }

  const clearAdvance = () => {
    if (advanceTimerRef.current) {
      window.clearTimeout(advanceTimerRef.current)
      advanceTimerRef.current = null
    }
  }

  useEffect(
    () => () => {
      clearAdvance()
      if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current)
      stopSpeaking()
    },
    [],
  )

  const goNext = useCallback(() => {
    clearAdvance()
    setPhase('answer')
    setUserAnswer('')
    setMatchResult(null)
    setSttError(null)
    setHintShown(voicePrimary ? false : prefs.hintDelaySec <= 0)
    setIndex((i) => {
      if (queue.length === 0) return 0
      return (i + 1) % queue.length
    })
  }, [prefs.hintDelaySec, queue.length, voicePrimary])

  const scheduleAdvance = useCallback(() => {
    clearAdvance()
    const ms = prefs.betweenCardsDelaySec * 1000
    if (ms <= 0) {
      goNext()
      return
    }
    advanceTimerRef.current = window.setTimeout(goNext, ms)
  }, [prefs.betweenCardsDelaySec, goNext])

  const runCheck = useCallback(
    (answerText: string) => {
      const c = cardRef.current
      if (!c) return
      const ok = answersMatch(answerText, c.en)
      setUserAnswer(answerText)
      setMatchResult(ok)
      setPhase('review')
      setHintShown(true)
      stopSpeaking()
      if (prefs.autoAdvanceAfterCheck) {
        void speakEnglishAsync(c.en).then(() => scheduleAdvance())
      } else {
        speakEnglish(c.en)
      }
    },
    [prefs.autoAdvanceAfterCheck, scheduleAdvance],
  )

  const beginListening = useCallback(async () => {
    setSttError(null)
    setSttLoading(true)
    try {
      const text = await listenEnglish()
      runCheck(text)
    } catch (e) {
      setSttError(e instanceof Error ? e.message : 'Ошибка микрофона')
    } finally {
      setSttLoading(false)
    }
  }, [runCheck])

  const beginListeningRef = useRef(beginListening)
  useEffect(() => {
    beginListeningRef.current = beginListening
  }, [beginListening])

  useEffect(() => {
    if (phase !== 'answer' || !card || !prefs.autoSpeakRuQuestion) return
    const gen = ++speakGenRef.current
    let cancelled = false
    void speakRussianAsync(card.ru).then(() => {
      if (cancelled || gen !== speakGenRef.current) return
      const vp = prefs.preferVoiceInput && isSpeechRecognitionAvailable()
      if (prefs.autoStartSttAfterRu && vp) {
        void beginListeningRef.current()
      }
    })
    return () => {
      cancelled = true
      stopSpeaking()
    }
  }, [card, phase, prefs.autoSpeakRuQuestion, prefs.autoStartSttAfterRu, prefs.preferVoiceInput])

  const handleTextSubmit = () => {
    if (!userAnswer.trim()) return
    runCheck(userAnswer)
  }

  const handleCheckClassic = () => {
    runCheck(userAnswer)
  }

  const handleShowAnswer = () => {
    setHintShown(true)
    if (card) speakEnglish(card.en)
  }

  const handleRepeatRu = () => {
    if (card) speakRussian(card.ru)
  }

  const handleRepeatEn = () => {
    if (card) speakEnglish(card.en)
  }

  const handleMark = () => {
    scheduleAdvance()
  }

  if (loading) {
    return (
      <div className="page train">
        <p className="muted">Загрузка…</p>
      </div>
    )
  }

  if (usable.length === 0) {
    return (
      <div className="page train">
        <h1>Тренировка</h1>
        <p className="muted">
          Нет карточек с заполненными полями RU и EN. Добавьте слова в словаре.
        </p>
        <Link className="btn primary" to="/deck">
          Открыть словарь
        </Link>
      </div>
    )
  }

  if (!card) {
    return (
      <div className="page train">
        <p className="muted">Очередь пуста.</p>
        <button
          type="button"
          className="btn primary"
          onClick={() => void reloadFromDb().then((c) => startSession(c, prefs))}
        >
          Обновить
        </button>
      </div>
    )
  }

  return (
    <div className="page train">
      <header className="page-header train-header">
        <div>
          <h1>Тренировка</h1>
          <p className="muted small">
            Карточка {index + 1} из {queue.length}
          </p>
        </div>
        <div className="train-actions">
          <button
            type="button"
            className="btn ghost"
            onClick={() => setSettingsOpen((o) => !o)}
            aria-expanded={settingsOpen}
          >
            {settingsOpen ? 'Скрыть настройки' : 'Темп и режим'}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => startSession(usable, prefs)}
          >
            Новая сессия
          </button>
        </div>
      </header>

      {settingsOpen && (
        <section className="settings-panel" aria-label="Настройки сессии">
          <div className="settings-grid">
            <label className="field">
              <span className="label">
                Авто-подсказка EN (сек)
                <span className="hint">
                  Только без голоса; 0 = по кнопке «Подсказка»
                </span>
              </span>
              <input
                className="input narrow"
                type="number"
                min={0}
                max={120}
                value={prefs.hintDelaySec}
                onChange={(e) =>
                  persistPrefs({
                    ...prefs,
                    hintDelaySec: Number(e.target.value) || 0,
                  })
                }
              />
            </label>
            <label className="field">
              <span className="label">
                Пауза перед следующей карточкой (сек)
                <span className="hint">После озвучки эталона; 0 = сразу</span>
              </span>
              <input
                className="input narrow"
                type="number"
                min={0}
                max={60}
                value={prefs.betweenCardsDelaySec}
                onChange={(e) =>
                  persistPrefs({
                    ...prefs,
                    betweenCardsDelaySec: Number(e.target.value) || 0,
                  })
                }
              />
            </label>
            <label className="field checkbox-field">
              <input
                type="checkbox"
                checked={prefs.shuffle}
                onChange={(e) =>
                  persistPrefs({ ...prefs, shuffle: e.target.checked })
                }
              />
              <span>Случайный порядок</span>
            </label>
            <label className="field checkbox-field">
              <input
                type="checkbox"
                checked={prefs.preferVoiceInput}
                onChange={(e) =>
                  persistPrefs({
                    ...prefs,
                    preferVoiceInput: e.target.checked,
                  })
                }
              />
              <span>Голосовой режим (микрофон + авто-проверка после ответа)</span>
            </label>
            <label className="field checkbox-field">
              <input
                type="checkbox"
                checked={prefs.autoSpeakRuQuestion}
                onChange={(e) =>
                  persistPrefs({
                    ...prefs,
                    autoSpeakRuQuestion: e.target.checked,
                  })
                }
              />
              <span>Озвучивать вопрос по-русски при новой карточке</span>
            </label>
            <label className="field checkbox-field">
              <input
                type="checkbox"
                checked={prefs.autoStartSttAfterRu}
                onChange={(e) =>
                  persistPrefs({
                    ...prefs,
                    autoStartSttAfterRu: e.target.checked,
                  })
                }
              />
              <span>Сразу слушать EN после русской фразы (без кнопки)</span>
            </label>
            <label className="field checkbox-field">
              <input
                type="checkbox"
                checked={prefs.autoAdvanceAfterCheck}
                onChange={(e) =>
                  persistPrefs({
                    ...prefs,
                    autoAdvanceAfterCheck: e.target.checked,
                  })
                }
              />
              <span>Авто-переход к следующей карточке после эталона</span>
            </label>
          </div>
        </section>
      )}

      <section className="prompt-block" aria-live="polite">
        <p className="prompt-label">Переведите на английский:</p>
        <p className="prompt-ru">{card.ru}</p>
        {phase === 'answer' && hintShown && (
          <p className="hint-en muted">
            Подсказка: <strong>{card.en}</strong>
          </p>
        )}
      </section>

      {phase === 'answer' && (
        <div className="answer-panel">
          {voicePrimary && (
            <>
              <div className="answer-buttons voice-primary-actions">
                <button
                  type="button"
                  className="btn primary large-btn"
                  onClick={() => void beginListening()}
                  disabled={sttLoading}
                >
                  {sttLoading ? 'Слушаю…' : 'Ответить голосом'}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={handleRepeatRu}
                >
                  Повторить вопрос (RU)
                </button>
                <button type="button" className="btn ghost" onClick={handleShowAnswer}>
                  Подсказка (EN)
                </button>
              </div>
              <label className="field block voice-fallback-input">
                <span className="label">
                  Или введите ответ (если микрофон ошибся) — Enter
                </span>
                <input
                  className="input large"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleTextSubmit()
                  }}
                  placeholder="Type English…"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  disabled={sttLoading}
                />
              </label>
              <div className="answer-buttons">
                <button
                  type="button"
                  className="btn"
                  onClick={handleTextSubmit}
                  disabled={!userAnswer.trim() || sttLoading}
                >
                  Готово
                </button>
              </div>
            </>
          )}

          {textVoiceFallback && (
            <>
              <p className="notice warn">
                В этом браузере нет распознавания речи — ответьте текстом и
                нажмите «Готово» или Enter.
              </p>
              <label className="field block">
                <span className="label">Ответ (EN)</span>
                <input
                  className="input large"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleTextSubmit()
                  }}
                  placeholder="English answer…"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
              </label>
              <div className="answer-buttons">
                <button type="button" className="btn" onClick={handleRepeatRu}>
                  Повторить вопрос (RU)
                </button>
                <button
                  type="button"
                  className="btn primary"
                  onClick={handleTextSubmit}
                  disabled={!userAnswer.trim()}
                >
                  Готово
                </button>
                <button type="button" className="btn ghost" onClick={handleShowAnswer}>
                  Подсказка (EN)
                </button>
              </div>
            </>
          )}

          {classicTyping && (
            <>
              <label className="field block">
                <span className="label">Ваш ответ (EN)</span>
                <input
                  className="input large"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  placeholder="English…"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
              </label>
              <div className="answer-buttons">
                <button
                  type="button"
                  className="btn primary"
                  onClick={handleRepeatRu}
                >
                  Повторить вопрос (RU)
                </button>
                <button type="button" className="btn primary" onClick={handleCheckClassic}>
                  Проверить
                </button>
                <button type="button" className="btn ghost" onClick={handleShowAnswer}>
                  Показать ответ и озвучить
                </button>
              </div>
            </>
          )}

          {sttError && <p className="notice error">{sttError}</p>}
        </div>
      )}

      {phase === 'review' && card && (
        <div className="review-panel">
          <p className={matchResult ? 'notice success' : 'notice warn'}>
            {matchResult
              ? 'Верно (по сравнению текста).'
              : 'Не совпало с эталоном.'}
          </p>
          <p className="expected">
            Эталон: <strong>{card.en}</strong>
          </p>
          <p className="muted small">
            Ваш вариант: {userAnswer.trim() || '—'}
          </p>
          <div className="review-buttons">
            <button type="button" className="btn" onClick={handleRepeatEn}>
              Повторить озвучку EN
            </button>
            <button type="button" className="btn ghost" onClick={goNext}>
              Следующая сейчас
            </button>
            {!prefs.autoAdvanceAfterCheck && (
              <button type="button" className="btn primary" onClick={handleMark}>
                Продолжить
              </button>
            )}
          </div>
          {prefs.autoAdvanceAfterCheck && prefs.betweenCardsDelaySec > 0 && (
            <p className="muted small">
              Следующая карточка через {prefs.betweenCardsDelaySec} с…
            </p>
          )}
        </div>
      )}
    </div>
  )
}
