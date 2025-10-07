import { openDB, DBSchema, IDBPDatabase } from 'idb';

const DB_NAME = 'bob-the-skelly-db';
const DB_VERSION = 1;
const STORE_NAME = 'youtube_audio';

interface AudioHistoryRecord {
  id: string; // YouTube video ID
  title: string;
  data: ArrayBuffer;
  timestamp: number;
}

interface AudioHistoryDB extends DBSchema {
  [STORE_NAME]: {
    key: string;
    value: AudioHistoryRecord;
    indexes: { 'timestamp': number };
  };
}

let dbPromise: Promise<IDBPDatabase<AudioHistoryDB>> | null = null;

function getDb(): Promise<IDBPDatabase<AudioHistoryDB>> {
  if (!dbPromise) {
    dbPromise = openDB<AudioHistoryDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp');
      },
    });
  }
  return dbPromise;
}

export async function addAudio(audio: Omit<AudioHistoryRecord, 'timestamp'>): Promise<void> {
  const db = await getDb();
  const record: AudioHistoryRecord = { ...audio, timestamp: Date.now() };
  await db.put(STORE_NAME, record);
}

export async function getAudio(id: string): Promise<AudioHistoryRecord | undefined> {
  const db = await getDb();
  return db.get(STORE_NAME, id);
}

// Returns only metadata to avoid loading all audio data into memory
export async function getAllAudioMetadata(): Promise<Omit<AudioHistoryRecord, 'data'>[]> {
  const db = await getDb();
  const allRecords = await db.getAllFromIndex(STORE_NAME, 'timestamp');
  // Reverse to show newest first, and return without the large data buffer
  return allRecords.reverse().map(({ data, ...metadata }) => metadata);
}

export async function deleteAudio(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAME, id);
}
