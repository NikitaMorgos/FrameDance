-- База знаний: мастер-классы (рекапы с видео и заметками)
-- Структура по стилю, уровню, типу навыка

CREATE TABLE IF NOT EXISTS master_classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Кто добавил (для мультипользователя и кабинета тренера)
  user_id TEXT,

  -- Структура базы знаний (по спецификации)
  style TEXT NOT NULL,           -- WCS, хастл, бачата, зук, СБТ, другое
  level TEXT,                   -- начальный, средний, продвинутый, все уровни
  skill_type TEXT,              -- техника, партнёрство, музыкальность, шоу, импровизация, другое

  -- Контент рекапа
  title TEXT,                   -- краткое название / тема МК
  notes TEXT NOT NULL,          -- текстовые заметки с мастер-класса
  video_file_id TEXT,           -- Telegram file_id (видео хранится у Telegram)
  video_url TEXT,               -- альтернативная ссылка на видео (YouTube, облако)

  -- Мета для поиска и программ подготовки
  tags TEXT,                    -- JSON array или comma-separated: теги для фильтрации
  source TEXT,                  -- преподаватель, школа, фестиваль (опционально)
  event_date TEXT               -- дата проведения МК (если известна)
);

CREATE INDEX IF NOT EXISTS idx_master_classes_style ON master_classes(style);
CREATE INDEX IF NOT EXISTS idx_master_classes_level ON master_classes(level);
CREATE INDEX IF NOT EXISTS idx_master_classes_skill_type ON master_classes(skill_type);
CREATE INDEX IF NOT EXISTS idx_master_classes_created ON master_classes(created_at);
CREATE INDEX IF NOT EXISTS idx_master_classes_user ON master_classes(user_id);

-- Одноразовые токены для входа на сайт (команда /login в боте)
CREATE TABLE IF NOT EXISTS login_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

-- Подписчики на запуск (форма «Узнать о запуске»)
CREATE TABLE IF NOT EXISTS subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(email);
