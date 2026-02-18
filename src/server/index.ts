import "dotenv/config";
import { createHmac } from "crypto";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import express from "express";
import cookieParser from "cookie-parser";
import { initDb } from "../db/index.js";
import { listMasterClasses, getMasterClassById } from "../knowledge/masterClasses.js";
import { consumeLoginToken } from "../knowledge/loginTokens.js";
import { verifyTelegramLogin } from "./telegramAuth.js";

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
app.get("/app", (_req, res) => {
  res.sendFile(join(process.cwd(), "public", "app.html"));
});

// Простая сессия: cookie хранит telegram_id (подпись через secret)
function getSessionSecret(): string {
  return process.env.SESSION_SECRET || botToken.slice(-16);
}
function signSession(userId: string): string {
  const h = createHmac("sha256", getSessionSecret()).update(userId).digest("hex").slice(0, 16);
  return `${userId}.${h}`;
}
function parseSession(cookie: string | undefined): string | null {
  if (!cookie) return null;
  const [userId, sig] = cookie.split(".");
  if (!userId || !sig) return null;
  const expected = signSession(userId);
  if (cookie !== expected) return null;
  return userId;
}

// GET /api/config — имя бота для виджета входа
app.get("/api/config", (_req, res) => {
  const botUsername = process.env.BOT_USERNAME || "FrameDance_bot";
  res.json({ botUsername });
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

// POST /api/auth/logout
app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.json({ ok: true });
});

// GET /api/me — текущий пользователь
app.get("/api/me", (req, res) => {
  const userId = parseSession(req.cookies?.[SESSION_COOKIE]);
  if (!userId) return res.status(401).json({ error: "Not logged in" });
  res.json({ id: userId });
});

// GET /api/recaps — список рекапов (только свои)
app.get("/api/recaps", (req, res) => {
  const userId = parseSession(req.cookies?.[SESSION_COOKIE]);
  if (!userId) return res.status(401).json({ error: "Not logged in" });
  const style = req.query.style as string | undefined;
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const offset = Number(req.query.offset) || 0;
  const list = listMasterClasses({ user_id: userId, style, limit, offset });
  res.json({ recaps: list });
});

// GET /api/recaps/:id — один рекап
app.get("/api/recaps/:id", (req, res) => {
  const userId = parseSession(req.cookies?.[SESSION_COOKIE]);
  if (!userId) return res.status(401).json({ error: "Not logged in" });
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "Bad id" });
  const row = getMasterClassById(id);
  if (!row) return res.status(404).json({ error: "Not found" });
  if (row.user_id && row.user_id !== userId) return res.status(403).json({ error: "Forbidden" });
  res.json(row);
});

// GET /api/recaps/:id/video — прокси видео из Telegram (чтобы не светить токен на клиенте)
app.get("/api/recaps/:id/video", async (req, res) => {
  const userId = parseSession(req.cookies?.[SESSION_COOKIE]);
  if (!userId) return res.status(401).json({ error: "Not logged in" });
  const id = Number(req.params.id);
  const row = getMasterClassById(id);
  if (!row || !row.video_file_id) return res.status(404).json({ error: "No video" });
  if (row.user_id && row.user_id !== userId) return res.status(403).json({ error: "Forbidden" });
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
