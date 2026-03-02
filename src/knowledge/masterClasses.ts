import { getDb } from "../db/index.js";
import type { MasterClassInsert, MasterClassRow } from "../db/index.js";

const STYLES = ["WCS", "хастл", "бачата", "зук", "СБТ", "другое"] as const;
const LEVELS = ["начальный", "средний", "продвинутый", "все уровни"] as const;
const SKILL_TYPES = [
  "техника",
  "партнёрство",
  "музыкальность",
  "шоу",
  "импровизация",
  "другое",
] as const;

export { STYLES, LEVELS, SKILL_TYPES };

export function addMasterClass(data: MasterClassInsert): MasterClassRow {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT INTO master_classes (
      user_id, style, level, skill_type, title, notes,
      video_file_id, video_url, tags, source, event_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    data.user_id ?? null,
    data.style,
    data.level ?? null,
    data.skill_type ?? null,
    data.title ?? null,
    data.notes,
    data.video_file_id ?? null,
    data.video_url ?? null,
    data.tags ?? null,
    data.source ?? null,
    data.event_date ?? null
  );
  return getMasterClassById(info.lastInsertRowid)!;
}

export function getMasterClassById(id: number): MasterClassRow | null {
  const database = getDb();
  const row = database.prepare("SELECT * FROM master_classes WHERE id = ?").get(id) as MasterClassRow | undefined;
  return row ?? null;
}

export function listMasterClasses(filters: {
  style?: string;
  level?: string;
  skill_type?: string;
  user_id?: string;
  limit?: number;
  offset?: number;
}): MasterClassRow[] {
  const database = getDb();
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filters.style) {
    conditions.push("style = ?");
    params.push(filters.style);
  }
  if (filters.level) {
    conditions.push("level = ?");
    params.push(filters.level);
  }
  if (filters.skill_type) {
    conditions.push("skill_type = ?");
    params.push(filters.skill_type);
  }
  if (filters.user_id) {
    // Показываем рекапы пользователя и рекапы без user_id (сохранённые до исправления или от имени канала)
    conditions.push("(user_id = ? OR user_id IS NULL)");
    params.push(filters.user_id);
  }

  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  const sql = `SELECT * FROM master_classes ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  const rows = database.prepare(sql).all(...params, limit, offset) as MasterClassRow[];
  return rows;
}

export function getStylesWithCounts(user_id?: string | null): { style: string; count: number }[] {
  const database = getDb();
  if (user_id) {
    return database
      .prepare(
        "SELECT style, COUNT(*) as count FROM master_classes WHERE user_id = ? GROUP BY style ORDER BY count DESC"
      )
      .all(user_id) as { style: string; count: number }[];
  }
  return database
    .prepare(
      "SELECT style, COUNT(*) as count FROM master_classes GROUP BY style ORDER BY count DESC"
    )
    .all() as { style: string; count: number }[];
}
