# RU → EN — тренировка

Статический прототип: словарь в **IndexedDB**, тренировка «вопрос по-русски → ответ по-английски», озвучка эталона (**Web Speech API**), опциональный ввод голосом, настройки темпа. Без бэкенда.

## Локально

```bash
npm install
npm run dev
```

Сборка:

```bash
npm run build
npm run preview
```

Для GitHub Pages в [vite.config.ts](vite.config.ts) уже задан относительный `base: './'` и в приложении используется `HashRouter`, чтобы пути работали из подкаталога репозитория.

## Деплой на GitHub Pages

1. В репозитории: **Settings → Pages → Build and deployment**: источник **Deploy from a branch**, ветка **`gh-pages`**, папка **`/(root)`** (ветку создаст workflow).
2. Запушьте в `main`: workflow [deploy-pages.yml](.github/workflows/deploy-pages.yml) соберёт проект и опубликует каталог `dist` в `gh-pages`.

Сайт будет доступен по адресу `https://<user>.github.io/<repo>/` (с `#/train` в URL при использовании hash-маршрутизации).

## Данные и бэкап

- Карточки хранятся в IndexedDB в браузере.
- Экспорт / импорт JSON — на экране «Словарь».
