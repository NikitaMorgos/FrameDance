# Проект на GitHub — по шагам

## Шаг 1. Создать репозиторий на GitHub

1. Зайди на **https://github.com** и войди в свой аккаунт (если нет — зарегистрируйся).
2. Справа вверху нажми зелёную кнопку **New** (или **+** → **New repository**).
3. Заполни:
   - **Repository name:** `FrameDance` (или другое имя — тогда его же используй в командах ниже).
   - **Description** (необязательно): «FrameDance — бот, сайт, база рекапов».
   - **Public**.
   - **НЕ ставь** галочки «Add a README», «Add .gitignore», «Choose a license» — у тебя уже есть локальный проект.
4. Нажми **Create repository**.

После этого GitHub покажет страницу с подсказками «…or push an existing repository from the command line». Переходи к шагу 2.

---

## Шаг 2. Открыть терминал в папке проекта

Открой **PowerShell** или **cmd**, перейди в папку FrameDance:

```powershell
cd "c:\Users\user\Dropbox\Public\Cursor\FrameDance"
```

(Или тот путь, где у тебя лежит проект.)

---

## Шаг 3. Если Git в папке ещё не инициализирован

Проверь: есть ли в папке папка `.git`. Если нет — выполни:

```powershell
git init
git branch -M main
```

Если `.git` уже есть (проект уже под Git) — эти команды можно не выполнять.

---

## Шаг 4. Добавить файлы и сделать первый коммит

```powershell
git add .
git status
```

`git status` покажет, что будет в коммите. Должны быть файлы проекта, без `.env` и без `node_modules` (они в .gitignore). Затем:

```powershell
git commit -m "FrameDance — бот, сайт, база рекапов"
```

---

## Шаг 5. Привязать удалённый репозиторий и отправить код

**Если репо на GitHub только что создал и remote ещё не добавлял:**

Подставь свой логин GitHub вместо `NikitaMorgos`, если логин другой:

```powershell
git remote add origin https://github.com/NikitaMorgos/FrameDance.git
git push -u origin main
```

**Если `origin` уже был добавлен раньше**, достаточно:

```powershell
git push -u origin main
```

---

## Шаг 6. Если Git просит логин и пароль

- **Username:** твой логин на GitHub (например, `NikitaMorgos`).
- **Password:** не пароль от аккаунта, а **Personal Access Token**:
  1. GitHub → твой аватар (справа вверху) → **Settings**.
  2. Слева внизу: **Developer settings** → **Personal access tokens** → **Tokens (classic)**.
  3. **Generate new token (classic)**.
  4. Note: например «FrameDance».
  5. Выбери срок действия (Expiration).
  6. Отметь право **repo**.
  7. **Generate token** — скопируй токен и вставь в поле пароля при `git push`. Больше токен не покажут, сохрани его.

---

## Готово

После успешного `git push` открой в браузере:

**https://github.com/NikitaMorgos/FrameDance**

(замени `NikitaMorgos` на свой логин, если создавал репо под другим аккаунтом)

Там будет весь код. Дальше можно подключать этот репозиторий к Render для деплоя сайта (см. [DEPLOY.md](DEPLOY.md)).

---

## Обновление репозитория потом

Когда что-то меняешь в проекте:

```powershell
cd "c:\Users\user\Dropbox\Public\Cursor\FrameDance"
git add .
git commit -m "кратко что сделал"
git push
```

После `git push` Render (если подключён) сам подхватит изменения и пересоберёт сайт.
