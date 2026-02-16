# Опубликовать сайт на framedance.ru — по порядку

Сделай шаги по очереди. Если сервис на Render уже создан — начни с шага 4.

---

## Шаг 1. Код на GitHub

1. В папке проекта выполни:
   ```powershell
   cd "c:\Users\user\Dropbox\Public\Cursor\FrameDance"
   git add .
   git status
   git commit -m "Готово к деплою на framedance.ru"
   git push
   ```
2. Убедись, что репозиторий **https://github.com/NikitaMorgos/FrameDance** содержит последние изменения.

---

## Шаг 2. Создать Web Service на Render

1. Открой **https://dashboard.render.com** и войди (лучше через GitHub).
2. Нажми **New +** → **Web Service**.
3. Выбери репозиторий **FrameDance** → **Connect**.
4. Заполни:
   - **Name:** `framedance`
   - **Branch:** `main`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm run start:all`
   - **Plan:** Free
5. В блоке **Environment** добавь переменные:
   - `TELEGRAM_BOT_TOKEN` — токен от @BotFather (одна строка, без пробелов)
   - `BOT_USERNAME` — `FrameDance_bot`
6. Нажми **Create Web Service**, дождись статуса **Live** (2–5 минут).
7. Скопируй URL сервиса (например `https://framedance-xxxx.onrender.com`) — пока сайт открывается по нему.

---

## Шаг 3. Привязать домен framedance.ru в Render

1. В Render открой свой сервис **framedance** → вкладка **Settings**.
2. Найди блок **Custom Domains** → **Add Custom Domain**.
3. Введи **framedance.ru** → Add.
4. При необходимости добавь **www.framedance.ru**.
5. Render покажет, какие DNS-записи нужно создать (CNAME или A-запись). Не закрывай эту подсказку — понадобится на следующем шаге.

---

## Шаг 4. Настроить DNS у регистратора домена

1. Зайди в панель управления доменом **framedance.ru** (сайт регистратора, где покупал домен).
2. Открой раздел управления DNS (DNS-записи, зона, DNS settings).
3. Добавь записи **точно так**, как показал Render:
   - Обычно для **framedance.ru**: CNAME → значение вида `framedance-xxxx.onrender.com` (или A-запись на IP, если Render дал IP).
   - Для **www**: CNAME `www` → тот же хост Render (например `framedance-xxxx.onrender.com`).
4. Сохрани изменения. Подожди 5–30 минут (иногда до часа), пока DNS обновится.
5. В Render в блоке Custom Domains напротив framedance.ru должен появиться зелёный статус (SSL выдастся автоматически).

---

## Шаг 5. Указать SITE_URL для бота

1. В Render: сервис **framedance** → **Environment**.
2. Добавь переменную:
   - **Key:** `SITE_URL`
   - **Value:** `https://framedance.ru`
3. Сохрани. Сделай **Manual Deploy** (вкладка **Manual Deploy** → **Deploy latest commit**), чтобы бот подхватил новую переменную.
4. После деплоя команда **/login** в боте будет присылать ссылку вида `https://framedance.ru/auth/verify?t=...`.

---

## Шаг 6. Домен для кнопки «Войти через Telegram»

1. В Telegram открой **@BotFather** → **/mybots** → выбери бота FrameDance.
2. **Edit Bot** → **Edit Bot Domain** (или пункт про домен).
3. Укажи домен: **framedance.ru** (без https:// и без пути).
4. Тогда кнопка «Log in with Telegram» на сайте будет работать на framedance.ru.

---

## Шаг 7. Проверка

1. Открой в браузере **https://framedance.ru** — должен открыться лендинг FrameDance.
2. В Telegram отправь боту **/login** — в ответ должна прийти ссылка на **https://framedance.ru/auth/verify?t=...**.
3. Открой эту ссылку — должен произойти вход и переход в базу рекапов.
4. На сайте нажми «Попробовать бесплатно» или «Войти» — проверь виджет Telegram (если домен указан в BotFather).

---

## Краткий чеклист

| № | Действие |
|---|----------|
| 1 | Запушить код в GitHub |
| 2 | Создать Web Service на Render, задать TELEGRAM_BOT_TOKEN и BOT_USERNAME, дождаться Live |
| 3 | В Render добавить Custom Domain: framedance.ru (и при желании www) |
| 4 | У регистратора домена добавить DNS-записи, как показал Render |
| 5 | В Render в Environment добавить SITE_URL=https://framedance.ru и сделать Manual Deploy |
| 6 | В BotFather указать домен framedance.ru для бота |
| 7 | Проверить https://framedance.ru и /login в боте |

Подробности по деплою — в [DEPLOY.md](DEPLOY.md), по домену и виджету — в [DOMAIN.md](DOMAIN.md).
