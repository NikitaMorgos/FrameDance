import "dotenv/config";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import { Markup } from "telegraf";
import { initDb, getDb } from "../db/index.js";
import {
  addMasterClass,
  listMasterClasses,
  getMasterClassById,
  getStylesWithCounts,
} from "../knowledge/masterClasses.js";
import { createLoginToken } from "../knowledge/loginTokens.js";
import { parseRecapCaption } from "../knowledge/parseRecapCaption.js";
import { hashPassword } from "../server/password.js";

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
const token = loadToken();
if (!token) {
  console.error("Задайте TELEGRAM_BOT_TOKEN в .env");
  process.exit(1);
}

const bot = new Telegraf(token);

// Состояние регистрации: user_id -> { step: 'email' | 'password', email?: string }
const registrationState = new Map<string, { step: "email"; email?: string } | { step: "password"; email: string }>();

const SITE_URL = (process.env.SITE_URL || process.env.RENDER_EXTERNAL_URL || "https://framedance.ru").trim();

// Рекап: пользователь присылает видео с подписью (текстовые заметки)
bot.on(message("video"), async (ctx) => {
  const video = ctx.message.video;
  const caption = ctx.message.caption ?? "";
  const fileId = video.file_id;

  const parsed = parseRecapCaption(caption);
  const userId = ctx.from?.id?.toString();

  try {
    const row = addMasterClass({
      user_id: userId,
      style: parsed.style,
      level: parsed.level,
      skill_type: parsed.skill_type,
      title: parsed.title,
      notes: parsed.notes,
      video_file_id: fileId,
    });

    const parts = [
      "✅ Рекап сохранён в базу знаний.",
      `ID: ${row.id}`,
      `Стиль: ${row.style}`,
      row.level ? `Уровень: ${row.level}` : null,
      row.skill_type ? `Навык: ${row.skill_type}` : null,
      row.title ? `Название: ${row.title}` : null,
    ].filter(Boolean);

    await ctx.reply(parts.join("\n"));
  } catch (e) {
    console.error(e);
    await ctx.reply("Не удалось сохранить рекап. Ошибка на сервере.");
  }
});

// Текстовое сообщение: команды и подсказка
bot.on(message("text"), async (ctx) => {
  const text = ctx.message.text.trim();
  const textLower = text.toLowerCase();
  const userId = ctx.from?.id?.toString();
  if (!userId) return;

  // Регистрация по шагам (email → пароль)
  const state = registrationState.get(userId);
  if (state) {
    if (textLower === "/cancel" || textLower === "отмена") {
      registrationState.delete(userId);
      await ctx.reply("Регистрация отменена.");
      return;
    }
    if (state.step === "email") {
      const email = text.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        await ctx.reply("Введите корректный email.");
        return;
      }
      registrationState.set(userId, { step: "password", email });
      await ctx.reply("Теперь введите пароль (не менее 6 символов). Он будет использоваться для входа на сайт.");
      return;
    }
    if (state.step === "password") {
      const password = text;
      if (password.length < 6) {
        await ctx.reply("Пароль должен быть не менее 6 символов. Введите пароль ещё раз.");
        return;
      }
      try {
        const password_hash = await hashPassword(password);
        const db = getDb();
        db.prepare("INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)").run(state.email, password_hash, null);
        registrationState.delete(userId);
        const site = SITE_URL.replace(/\/$/, "");
        await ctx.reply(
          `✅ Готово. Вы зарегистрированы.\n\n` +
            `На сайте ${site} нажмите «Войти» и введите:\n` +
            `• Логин: ${state.email}\n` +
            `• Пароль: (тот, что вы только что ввели)\n\n` +
            `Эту пару логин/пароль сохраните — с ней вы входите в личный кабинет.`
        );
      } catch (e) {
        const msg = String((e as Error).message || "");
        if (msg.includes("UNIQUE") || msg.includes("unique")) {
          registrationState.delete(userId);
          await ctx.reply("Этот email уже зарегистрирован. Войдите на сайт с ним или используйте другой email (/register).");
        } else {
          console.error("Register in bot:", e);
          await ctx.reply("Ошибка при регистрации. Попробуйте позже или зарегистрируйтесь на сайте.");
        }
      }
      return;
    }
  }

  const cmd = textLower.split(/\s/)[0];
  if (cmd === "/start" || cmd.startsWith("/start@") || cmd === "/help" || cmd.startsWith("/help@") || textLower === "помощь") {
    await ctx.reply(
      "Привет! Я помогаю вести базу знаний по мастер-классам.\n\n" +
        "📹 Отправь *видео* рекапа с мастер-класса и в *подписи* напиши заметки.\n\n" +
        "📂 /list — база рекапов. /register — зарегистрироваться для входа на сайт (email и пароль).\n\n" +
        "Чтобы рекап попал в нужный раздел, в подписи укажи (по желанию):\n" +
        "Стиль: WCS | хастл | бачата | зук | СБТ | другое\n" +
        "Уровень: начальный | средний | продвинутый | все уровни\n" +
        "Навык: техника | партнёрство | музыкальность | шоу | импровизация | другое\n" +
        "Название: тема МК",
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([[Markup.button.callback("📂 Открыть базу рекапов", "list:")]]),
      }
    );
    return;
  }

  if (cmd === "/list" || cmd.startsWith("/list@") || text === "база" || text === "мои рекапы" || text === "список") {
    await sendRecapList(ctx, userId, undefined);
    return;
  }

  if (cmd === "/login" || cmd.startsWith("/login@")) {
    const siteUrl = (process.env.SITE_URL || process.env.RENDER_EXTERNAL_URL || "").trim();
    const isPublic = siteUrl.length > 0 && !/^https?:\/\/localhost(\b|:)/i.test(siteUrl);
    if (isPublic && userId) {
      const token = createLoginToken(userId, 30);
      const link = `${siteUrl.replace(/\/$/, "")}/auth/verify?t=${token}`;
      await ctx.reply(
        `Вход на сайт с базой рекапов (ссылка 30 мин):\n\n${link}\n\nОткрой ссылку в браузере сразу — на бесплатном хостинге сервер может «засыпать», и старая ссылка перестанет работать.`
      );
    } else {
      const projectUrl = "https://nikitamorgos.github.io/FrameDance/";
      await ctx.reply(
        `Сайт проекта FrameDance:\n\n${projectUrl}\n\nБаза рекапов с входом по ссылке доступна, когда сервер запущен (локально или на хостинге). Чтобы бот отправлял ссылку для входа в базу, укажи в .env переменную SITE_URL с адресом развёрнутого сайта.`
      );
    }
    return;
  }

  if (cmd === "/register" || cmd.startsWith("/register@")) {
    registrationState.set(userId, { step: "email" });
    await ctx.reply("Введите email — он будет логином на сайте framedance.ru:");
    return;
  }

  await ctx.reply(
    "Отправь видео с подписью — сохраню рекап. /list — база рекапов. /help — подсказка.",
    Markup.inlineKeyboard([[Markup.button.callback("📂 База рекапов", "list:")]])
  );
});

// Список рекапов (по user_id, опционально по стилю)
async function sendRecapList(
  ctx: { reply: (a: string, b?: object) => Promise<unknown>; from?: { id: number }; editMessageText?: (a: string, b?: object) => Promise<unknown> },
  userId: string | undefined,
  style: string | undefined
) {
  const list = listMasterClasses({
    user_id: userId ?? undefined,
    style,
    limit: 10,
    offset: 0,
  });
  if (list.length === 0) {
    const msg = style
      ? `Рекапов по стилю «${style}» пока нет.`
      : "В базе пока нет рекапов. Отправь видео с подписью — добавлю.";
    await ctx.reply(msg, style ? Markup.inlineKeyboard([[Markup.button.callback("◀ Все рекапы", "list:")]]) : undefined);
    return;
  }
  const lines = list.map(
    (r) => `• ${r.id}. ${r.title || "Без названия"} — ${r.style}${r.level ? `, ${r.level}` : ""}`
  );
  const styleRow = getStylesWithCounts(userId ?? undefined);
  const detailButtons = list.slice(0, 6).map((r) =>
    Markup.button.callback(
      `#${r.id} ${(r.title || r.notes.slice(0, 15)).slice(0, 20)}${(r.title || r.notes).length > 20 ? "…" : ""}`,
      `recap:${r.id}`
    )
  );
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  for (let i = 0; i < detailButtons.length; i += 2) {
    rows.push(detailButtons.slice(i, i + 2));
  }
  if (styleRow.length > 0) {
    rows.push(
      styleRow.slice(0, 3).map((s) =>
        Markup.button.callback(`${s.style} (${s.count})`, `list:${s.style}`)
      )
    );
    rows.push([Markup.button.callback("◀ Все рекапы", "list:")]);
  }
  const text =
    (style ? `📂 Рекапы: ${style}\n\n` : "📂 Твоя база рекапов\n\n") +
    lines.join("\n") +
    "\n\nНажми на рекап — покажу заметки и видео.";
  await ctx.reply(text, {
    parse_mode: "Markdown",
    ...Markup.inlineKeyboard(rows),
  });
}

// Обработка нажатий на кнопки
bot.action(/^list:(.*)$/, async (ctx) => {
  const style = ctx.match[1] || undefined;
  const userId = ctx.from?.id?.toString();
  await sendRecapList(ctx, userId, style === "" ? undefined : style);
  if (ctx.callbackQuery.message && "message_id" in ctx.callbackQuery.message) {
    await ctx.deleteMessage().catch(() => {});
  }
  await ctx.answerCbQuery();
});

bot.action(/^recap:(\d+)$/, async (ctx) => {
  const id = Number(ctx.match[1]);
  const userId = ctx.from?.id?.toString();
  const row = getMasterClassById(id);
  if (!row) {
    await ctx.answerCbQuery("Рекап не найден.");
    return;
  }
  if (row.user_id && row.user_id !== userId) {
    await ctx.answerCbQuery("Нет доступа.");
    return;
  }
  const caption =
    `📌 #${row.id} ${row.title || "Рекап"}\n` +
    `Стиль: ${row.style}${row.level ? ` | ${row.level}` : ""}${row.skill_type ? ` | ${row.skill_type}` : ""}\n\n` +
    row.notes;
  if (row.video_file_id) {
    await ctx.replyWithVideo(row.video_file_id, { caption });
  } else {
    await ctx.reply(caption);
  }
  if (ctx.callbackQuery.message && "text" in ctx.callbackQuery.message) {
    await ctx.deleteMessage().catch(() => {});
  }
  await ctx.answerCbQuery();
});

const launchBot = async (retries = 3): Promise<void> => {
  for (let i = 0; i < retries; i++) {
    try {
      await bot.launch();
      console.log("Бот запущен (база знаний: мастер-классы).");
      return;
    } catch (e: unknown) {
      const msg = String((e as { response?: { description?: string }; message?: string })?.response?.description ?? (e as Error).message ?? e);
      const is409 = msg.includes("409") || msg.includes("Conflict") || msg.includes("getUpdates");
      if (is409 && i < retries - 1) {
        const wait = 15;
        console.warn(`Конфликт бота (другой экземпляр?). Ждём ${wait} с и повторяем (${i + 1}/${retries})...`);
        await new Promise((r) => setTimeout(r, wait * 1000));
      } else {
        console.error("Ошибка запуска бота:", e);
        process.exit(1);
      }
    }
  }
};

(async () => {
  try {
    await initDb();
    await bot.telegram.setMyCommands([
      { command: "start", description: "Начать / приветствие" },
      { command: "help", description: "Подсказка по формату рекапов" },
      { command: "list", description: "Открыть базу рекапов" },
      { command: "register", description: "Регистрация: email и пароль для входа на сайт" },
      { command: "login", description: "Ссылка для входа на сайт (по токену)" },
    ]);
    await bot.telegram.setChatMenuButton({ menuButton: { type: "commands" } });
    await launchBot();
  } catch (e) {
    console.error("Ошибка запуска бота:", e);
    process.exit(1);
  }
})();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
