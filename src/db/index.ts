import initSqlJs, { type Database as SqlJsDatabase } from "sql.js";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Путь к БД относительно папки проекта (где package.json), чтобы бот и сервер использовали одну базу
const projectRoot = join(__dirname, "..", "..");
const DEFAULT_DB_PATH = join(projectRoot, "data", "framedance.db");

export function getDbPath(): string {
  return process.env.DATABASE_PATH ?? DEFAULT_DB_PATH;
}

let db: SqlJsDatabase | null = null;
let dbPath: string | null = null;

function saveDb(): void {
  if (!db || !dbPath) return;
  const dir = dirname(dbPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const data = db.export();
  writeFileSync(dbPath, Buffer.from(data));
}

/** API, совместимый с better-sqlite3: prepare().run/get/all */
export function getDb(): {
  prepare: (sql: string) => {
    run: (...params: unknown[]) => { lastInsertRowid: number };
    get: (...params: unknown[]) => Record<string, unknown> | undefined;
    all: (...params: unknown[]) => Record<string, unknown>[];
  };
  exec: (sql: string) => void;
} {
  if (!db) throw new Error("DB not initialized. Call initDb() first.");
  return {
    prepare(sql: string) {
      return {
        run(...params: unknown[]) {
          const stmt = db!.prepare(sql);
          try {
            stmt.bind(params as number[]);
            stmt.step();
          } finally {
            stmt.free();
          }
          const res = db!.exec("SELECT last_insert_rowid() as id");
          const lastInsertRowid = res[0]?.values[0]?.[0] as number ?? 0;
          saveDb();
          return { lastInsertRowid };
        },
        get(...params: unknown[]) {
          const stmt = db!.prepare(sql);
          try {
            stmt.bind(params as number[]);
            if (!stmt.step()) return undefined;
            const names = stmt.getColumnNames();
            const row = stmt.get();
            const obj: Record<string, unknown> = {};
            names.forEach((n, i) => { obj[n] = row[i]; });
            return obj;
          } finally {
            stmt.free();
          }
        },
        all(...params: unknown[]) {
          const stmt = db!.prepare(sql);
          const rows: Record<string, unknown>[] = [];
          try {
            stmt.bind(params as number[]);
            const names = stmt.getColumnNames();
            while (stmt.step()) {
              const row = stmt.get();
              const obj: Record<string, unknown> = {};
              names.forEach((n, i) => { obj[n] = row[i]; });
              rows.push(obj);
            }
            return rows;
          } finally {
            stmt.free();
          }
        },
      };
    },
    exec(sql: string) {
      db!.run(sql);
      saveDb();
    },
  };
}

export async function initDb(): Promise<void> {
  if (db) return;
  const path = getDbPath();
  dbPath = path;
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const SQL = await initSqlJs();
  let data: Uint8Array | undefined;
  if (existsSync(path)) {
    data = new Uint8Array(readFileSync(path));
  }
  db = new SQL.Database(data);
  db.run("PRAGMA journal_mode = WAL");
  const schemaPath = join(__dirname, "schema.sql");
  const schema = readFileSync(schemaPath, "utf-8");
  db.exec(schema);
  saveDb();
}

export interface MasterClassRow {
  id: number;
  created_at: string;
  user_id: string | null;
  style: string;
  level: string | null;
  skill_type: string | null;
  title: string | null;
  notes: string;
  video_file_id: string | null;
  video_url: string | null;
  tags: string | null;
  source: string | null;
  event_date: string | null;
}

export interface MasterClassInsert {
  user_id?: string | null;
  style: string;
  level?: string | null;
  skill_type?: string | null;
  title?: string | null;
  notes: string;
  video_file_id?: string | null;
  video_url?: string | null;
  tags?: string | null;
  source?: string | null;
  event_date?: string | null;
}
