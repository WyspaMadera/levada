/** Eksport / import postępów jako JSON. Nagrania głosu (pliki audio) nie są eksportowane — zostają na urządzeniu. */
import { z } from 'zod';
import { db, DB_TABLES, type BackupTable } from './db';

export const BACKUP_FORMAT = 'levada-backup';
export const BACKUP_VERSION = 1;

export type Backup = {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  tables: Record<BackupTable, unknown[]>;
};

const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.number().int().min(1),
  exportedAt: z.string(),
  tables: z.record(z.string(), z.array(z.unknown())),
});

export async function exportData(): Promise<Backup> {
  const tables = {} as Record<BackupTable, unknown[]>;
  for (const t of DB_TABLES) tables[t] = await db.table(t).toArray();
  // token serwera AI nie trafia do pliku kopii (to sekret dostępu)
  tables.settings = tables.settings.map((s) => ({ ...(s as object), aiToken: null }));
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), tables };
}

export function backupFileName(d = new Date()) {
  return `levada-postepy-${d.toISOString().slice(0, 10)}.json`;
}

/** Daty kart FSRS po JSON są tekstem — przywracamy obiekty Date (indeks `due`). */
function revive(table: BackupTable, row: unknown): unknown {
  if (table === 'cards' && row && typeof row === 'object') {
    const r = row as Record<string, unknown>;
    return { ...r, due: new Date(r.due as string), last_review: r.last_review ? new Date(r.last_review as string) : undefined };
  }
  return row;
}

export type ImportSummary = Record<BackupTable, number>;

export async function importData(json: unknown, mode: 'replace' = 'replace'): Promise<ImportSummary> {
  const parsed = backupSchema.safeParse(json);
  if (!parsed.success) throw new Error('To nie jest plik kopii zapasowej Levady (lub plik jest uszkodzony).');
  if (parsed.data.version > BACKUP_VERSION) throw new Error('Kopia pochodzi z nowszej wersji aplikacji. Zaktualizuj aplikację.');
  const summary = {} as ImportSummary;
  await db.transaction('rw', DB_TABLES.map((t) => db.table(t)), async () => {
    for (const t of DB_TABLES) {
      const rows = (parsed.data.tables[t] ?? []).map((r) => revive(t, r));
      if (mode === 'replace') await db.table(t).clear();
      await db.table(t).bulkPut(rows);
      summary[t] = rows.length;
    }
  });
  return summary;
}
