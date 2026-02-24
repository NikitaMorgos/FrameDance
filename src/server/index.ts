import "dotenv/config";
import { createHmac } from "crypto";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import express from "express";
import cookieParser from "cookie-parser";
import { initDb, getDb } from "../db/index.js";
import { listMasterClasses, getMasterClassById } from "../knowledge/masterClasses.js";
import { consumeLoginToken } from "../knowledge/loginTokens.js";
import { verifyTelegramLogin } from "./telegramAuth.js";
import { hashPassword, verifyPassword } from "./password.js";

function loadToken(): string {
  let t = process.env.TELEGRAM_BOT_TOKEN?.replace(/\s/g, "").trim() ?? "";
  if (t.length >= 40) return t;
  const envPath = join(process.cwd(), ".env");
  if (existsSync(envPath)) {
    const lines = readFileSync(envPath, "utf-8").split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith("TELEGRAM_BOT_TOKEN=")) {
        t = line.slice("TELEGRAM_BOT_TOKEN=".length).trim();
        while (t.length < 40 && i + 1 < lines.length) {
          const next = lines[++i].trim();
          if (!next || next.startsWith("#") || /^[A-Z][A-Z0-9_]*\s*=/.test(next)) break;
          t += next;
        }
        break;
      }
    }
    t = t.replace(/\s/g, "");
  }
  return t;
}

const botToken = loadToken();
const SESSION_COOKIE = "framedance_session";
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

const app = express();
app.use(cookieParser());
app.use(express.json());
// Главная страница — лендинг FrameDance из public/index.html
app.get("/", (_req, res) => {
  res.sendFile(join(process.cwd(), "public", "index.html"));
});
app.use(express.static(join(process.cwd(), "public")));
app.get("/app", (req, res) => {
  if (!getEmailUserId(req.cookies?.[SESSION_COOKIE])) {
    return res.redirect("/login");
  }
  res.sendFile(join(process.cwd(), "public", "app.html"));
});
app.get("/login", (_req, res) => {
  res.sendFile(join(process.cwd(), "public", "login.html"));
});

// Сессия: для входа по email храним "e" + users.id; для Telegram — "t" + telegram_id
function getSessionSecret(): string {
  return process.env.SESSION_SECRET || botToken.slice(-16);
}
function signSession(payload: string): string {
  const h = createHmac("sha256", getSessionSecret()).update(payload).digest("hex").slice(0, 16);
  return `${payload}.${h}`;
}
function parseSession(cookie: string | undefined): string | null {
  if (!cookie) return null;
  const [payload, sig] = cookie.split(".");
  if (!payload || !sig) return null;
  if (cookie !== signSession(payload)) return null;
  return payload;
}

/** ID пользователя из таблицы users (вход по email). Если сессия от Telegram — null. */
function getEmailUserId(cookie: string | undefined): number | null {
  const payload = parseSession(cookie);
  if (!payload || !payload.startsWith("e")) return null;
  const id = parseInt(payload.slice(1), 10);
  return Number.isFinite(id) ? id : null;
}

// GET /api/config — имя бота для виджета входа
app.get("/api/config", (_req, res) => {
  const botUsername = process.env.BOT_USERNAME || "FrameDance_bot";
  res.json({ botUsername });
});

// POST /api/subscribe — подписка на запуск (форма «Узнать о запуске»)
app.post("/api/subscribe", (req, res) => {
  const email = (req.body?.email as string)?.trim()?.toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Некорректный email" });
  }
  try {
    const db = getDb();
    db.prepare("INSERT INTO subscribers (email) VALUES (?)").run(email);
    res.json({ ok: true });
  } catch (e) {
    // UNIQUE constraint — уже подписан
    const msg = String((e as Error).message || "");
    if (msg.includes("UNIQUE") || msg.includes("unique")) {
      return res.json({ ok: true }); // не раскрываем, что уже в базе
    }
    console.error("Subscribe error:", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// GET /api/auth/telegram-callback — редирект от Telegram Login Widget (query-параметры)
app.get("/api/auth/telegram-callback", (req, res) => {
  const params = req.query as Record<string, string>;
  const user = verifyTelegramLogin(botToken, params);
  if (!user) {
    return res.redirect("/?error=invalid");
  }
  const session = signSession(user.id);
  res.cookie(SESSION_COOKIE, session, {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE * 1000,
    sameSite: "lax",
    path: "/",
  });
  res.redirect("/app");
});

// POST /api/auth/telegram — данные от виджета (callback mode)
app.post("/api/auth/telegram", (req, res) => {
  const user = verifyTelegramLogin(botToken, req.body as Record<string, string>);
  if (!user) {
    return res.status(401).json({ error: "Invalid Telegram data" });
  }
  const session = signSession(user.id);
  res.cookie(SESSION_COOKIE, session, {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE * 1000,
    sameSite: "lax",
    path: "/",
  });
  res.json({ ok: true, user: { id: user.id, username: user.username, first_name: user.first_name } });
});

// GET /auth/verify?t=TOKEN — вход по ссылке из бота (команда /login)
app.get("/auth/verify", (req, res) => {
  const token = (req.query.t as string)?.trim();
  if (!token) {
    return res.redirect("/?error=no_token");
  }
  const userId = consumeLoginToken(token);
  if (!userId) {
    return res.redirect("/?error=expired");
  }
  const session = signSession(userId);
  res.cookie(SESSION_COOKIE, session, {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE * 1000,
    sameSite: "lax",
    path: "/",
  });
  res.redirect("/app");
});

// POST /api/auth/register — регистрация по email и паролю
app.post("/api/auth/register", async (req, res) => {
  const email = (req.body?.email as string)?.trim()?.toLowerCase();
  const password = req.body?.password as string;
  const name = (req.body?.name as string)?.trim() || null;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Некорректный email" });
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    return res.status(400).json({ error: "Пароль не менее 6 символов" });
  }
  try {
    const password_hash = await hashPassword(password);
    const db = getDb();
    const { lastInsertRowid } = db.prepare("INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)").run(email, password_hash, name ?? null);
    const row = db.prepare("SELECT id, email, name FROM users WHERE id = ?").get(Number(lastInsertRowid)) as { id: number; email: string; name: string | null };
    const session = signSession("e" + row.id);
    res.cookie(SESSION_COOKIE, session, {
      httpOnly: true,
      maxAge: SESSION_MAX_AGE * 1000,
      sameSite: "lax",
      path: "/",
    });
    res.status(201).json({ ok: true, user: { id: row.id, email: row.email, name: row.name } });
  } catch (e) {
    const msg = String((e as Error).message || "");
    if (msg.includes("UNIQUE") || msg.includes("unique")) {
      return res.status(409).json({ error: "Такой email уже зарегистрирован" });
    }
    console.error("Register error:", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// POST /api/auth/login — вход по email и паролю
app.post("/api/auth/login", async (req, res) => {
  const email = (req.body?.email as string)?.trim()?.toLowerCase();
  const password = req.body?.password as string;
  if (!email || !password) {
    return res.status(400).json({ error: "Укажите email и пароль" });
  }
  const db = getDb();
  const row = db.prepare("SELECT id, email, name, password_hash FROM users WHERE email = ?").get(email) as
    | { id: number; email: string; name: string | null; password_hash: string }
    | undefined;
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    return res.status(401).json({ error: "Неверный email или пароль" });
  }
  const session = signSession("e" + row.id);
  res.cookie(SESSION_COOKIE, session, {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE * 1000,
    sameSite: "lax",
    path: "/",
  });
  res.json({ ok: true, user: { id: row.id, email: row.email, name: row.name } });
});

// POST /api/auth/logout
app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.json({ ok: true });
});

// GET /api/me — текущий пользователь (только для входа по email)
app.get("/api/me", (req, res) => {
  const userId = getEmailUserId(req.cookies?.[SESSION_COOKIE]);
  if (!userId) return res.status(401).json({ error: "Not logged in" });
  const row = getDb().prepare("SELECT id, email, name FROM users WHERE id = ?").get(userId) as
    | { id: number; email: string; name: string | null }
    | undefined;
  if (!row) return res.status(401).json({ error: "Not logged in" });
  res.json({ id: row.id, email: row.email, name: row.name });
});

// GET /api/recaps — список рекапов (только свои, только для входа по email)
app.get("/api/recaps", (req, res) => {
  const userId = getEmailUserId(req.cookies?.[SESSION_COOKIE]);
  if (!userId) return res.status(401).json({ error: "Not logged in" });
  const style = req.query.style as string | undefined;
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const offset = Number(req.query.offset) || 0;
  const list = listMasterClasses({ user_id: String(userId), style, limit, offset });
  res.json({ recaps: list });
});

// GET /api/recaps/:id — один рекап
app.get("/api/recaps/:id", (req, res) => {
  const userId = getEmailUserId(req.cookies?.[SESSION_COOKIE]);
  if (!userId) return res.status(401).json({ error: "Not logged in" });
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "Bad id" });
  const row = getMasterClassById(id);
  if (!row) return res.status(404).json({ error: "Not found" });
  if (row.user_id && row.user_id !== String(userId)) return res.status(403).json({ error: "Forbidden" });
  res.json(row);
});

// GET /api/recaps/:id/video — прокси видео из Telegram (чтобы не светить токен на клиенте)
app.get("/api/recaps/:id/video", async (req, res) => {
  const userId = getEmailUserId(req.cookies?.[SESSION_COOKIE]);
  if (!userId) return res.status(401).json({ error: "Not logged in" });
  const id = Number(req.params.id);
  const row = getMasterClassById(id);
  if (!row || !row.video_file_id) return res.status(404).json({ error: "No video" });
  if (row.user_id && row.user_id !== String(userId)) return res.status(403).json({ error: "Forbidden" });
  try {
    const r = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(row.video_file_id)}`
    );
    const data = (await r.json()) as { ok: boolean; result?: { file_path: string } };
    if (!data.ok || !data.result?.file_path) return res.status(502).json({ error: "Telegram file error" });
    const videoUrl = `https://api.telegram.org/file/bot${botToken}/${data.result.file_path}`;
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) return res.status(502).json({ error: "Failed to fetch video" });
    res.setHeader("Content-Type", videoRes.headers.get("content-type") || "video/mp4");
    videoRes.body?.pipe(res);
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

const PORT = Number(process.env.PORT) || 3000;

(async () => {
  try {
    await initDb();
    app.listen(PORT, () => {
      console.log(`Сайт: http://localhost:${PORT}`);
    });
  } catch (e) {
    console.error("Ошибка запуска сервера:", e);
    process.exit(1);
  }
})();
