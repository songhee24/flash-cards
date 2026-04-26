import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Card, ExportPayload } from '../types'

interface FlashCardsDB extends DBSchema {
  cards: {
    key: string
    value: Card
    indexes: { 'by-created': number }
  }
}

const DB_NAME = 'flash-cards-app'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<FlashCardsDB>> | null = null

function getDB(): Promise<IDBPDatabase<FlashCardsDB>> {
  if (!dbPromise) {
    dbPromise = openDB<FlashCardsDB>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        const store = database.createObjectStore('cards', { keyPath: 'id' })
        store.createIndex('by-created', 'createdAt')
      },
    })
  }
  return dbPromise
}

export async function getAllCards(): Promise<Card[]> {
  const db = await getDB()
  return db.getAll('cards')
}

export async function getCardsSorted(): Promise<Card[]> {
  const cards = await getAllCards()
  return cards.sort((a, b) => a.createdAt - b.createdAt)
}

export async function putCard(card: Card): Promise<void> {
  const db = await getDB()
  await db.put('cards', card)
}

export async function deleteCard(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('cards', id)
}

export async function exportCardsJSON(): Promise<string> {
  const cards = await getAllCards()
  const payload: ExportPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    cards: cards.sort((a, b) => a.createdAt - b.createdAt),
  }
  return JSON.stringify(payload, null, 2)
}

export function parseImportJSON(text: string): Card[] {
  const data = JSON.parse(text) as ExportPayload | { cards?: Card[] }
  if (data && Array.isArray((data as ExportPayload).cards)) {
    return (data as ExportPayload).cards.map((c) => ({
      id: String(c.id),
      ru: String(c.ru ?? ''),
      en: String(c.en ?? ''),
      createdAt: typeof c.createdAt === 'number' ? c.createdAt : Date.now(),
    }))
  }
  throw new Error('Неверный формат JSON')
}

export async function importCardsMerge(text: string): Promise<number> {
  const incoming = parseImportJSON(text)
  const db = await getDB()
  let count = 0
  const tx = db.transaction('cards', 'readwrite')
  for (const c of incoming) {
    if (!c.ru.trim() && !c.en.trim()) continue
    await tx.store.put({
      ...c,
      id: c.id || crypto.randomUUID(),
      createdAt: c.createdAt || Date.now(),
    })
    count++
  }
  await tx.done
  return count
}
