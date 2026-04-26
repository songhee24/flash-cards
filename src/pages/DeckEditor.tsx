import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEventHandler,
} from 'react'
import type { Card } from '../types'
import {
  deleteCard,
  exportCardsJSON,
  getCardsSorted,
  importCardsMerge,
  putCard,
} from '../storage/db'

function newCard(partial?: Partial<Card>): Card {
  return {
    id: crypto.randomUUID(),
    ru: partial?.ru ?? '',
    en: partial?.en ?? '',
    createdAt: partial?.createdAt ?? Date.now(),
  }
}

export default function DeckEditor() {
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const cardsRef = useRef<Card[]>([])

  useEffect(() => {
    cardsRef.current = cards
  }, [cards])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await getCardsSorted()
      setCards(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await getCardsSorted()
        if (!cancelled) setCards(list)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Ошибка загрузки')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleAdd = async () => {
    const card = newCard()
    setCards((prev) => [...prev, card])
    await putCard(card)
  }

  const handleChange = (id: string, field: 'ru' | 'en', value: string) => {
    setCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)),
    )
  }

  const handleBlurPersist = async (id: string) => {
    const c = cardsRef.current.find((x) => x.id === id)
    if (c) await putCard(c)
  }

  const handleDelete = async (id: string) => {
    await deleteCard(id)
    setCards((prev) => prev.filter((c) => c.id !== id))
  }

  const handleExport = async () => {
    const json = await exportCardsJSON()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `flash-cards-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportFile: ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImportMsg(null)
    setError(null)
    try {
      const text = await file.text()
      const n = await importCardsMerge(text)
      setImportMsg(`Импортировано карточек: ${n}`)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка импорта')
    }
  }

  return (
    <div className="page deck-editor">
      <header className="page-header">
        <h1>Словарь</h1>
        <p className="muted">
          Пара «русский вопрос / английский ответ». Пустые строки при сохранении
          допустимы, но в тренировке такие карточки лучше не использовать.
        </p>
      </header>

      <div className="toolbar">
        <button type="button" className="btn primary" onClick={() => void handleAdd()}>
          Добавить карточку
        </button>
        <button type="button" className="btn" onClick={() => void handleExport()}>
          Экспорт JSON
        </button>
        <label className="btn file-label">
          Импорт JSON
          <input type="file" accept="application/json,.json" hidden onChange={handleImportFile} />
        </label>
      </div>

      {importMsg && <p className="notice success">{importMsg}</p>}
      {error && <p className="notice error">{error}</p>}

      {loading ? (
        <p className="muted">Загрузка…</p>
      ) : cards.length === 0 ? (
        <p className="muted">Пока нет карточек. Добавьте первую.</p>
      ) : (
        <ul className="card-list">
          {cards.map((c) => (
            <li key={c.id} className="card-row">
              <label className="field">
                <span className="label">RU</span>
                <input
                  className="input"
                  value={c.ru}
                  onChange={(e) => void handleChange(c.id, 'ru', e.target.value)}
                  onBlur={() => void handleBlurPersist(c.id)}
                  placeholder="Вопрос по-русски"
                  autoComplete="off"
                />
              </label>
              <label className="field">
                <span className="label">EN</span>
                <input
                  className="input"
                  value={c.en}
                  onChange={(e) => void handleChange(c.id, 'en', e.target.value)}
                  onBlur={() => void handleBlurPersist(c.id)}
                  placeholder="Ответ по-английски"
                  autoComplete="off"
                />
              </label>
              <button
                type="button"
                className="btn danger ghost"
                onClick={() => void handleDelete(c.id)}
                aria-label="Удалить карточку"
              >
                Удалить
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
