# Pocket Fishing (pixel-fishing)
Крошечная 3D-пиксельная рыбалка в браузере. Vite + Three.js.

Запуск: `npm install && npm run dev`, сборка: `npm run build` (папка `dist/`).

Управление: тап/клик — закинуть; когда поплавок дёргается («КЛЮЁТ!») — тап, чтобы подсечь.

Проверки: `npm test`, затем `npm run build`.

Деплой: в настройках репозитория **Settings → Pages → Source** выберите **GitHub Actions**.
Единственный workflow `.github/workflows/deploy.yml` запускается при push в `main`
или вручную, проверяет игру, собирает `dist/` и публикует на GitHub Pages.
Относительная база Vite `./` поддерживает адрес с префиксом `/pixel-fishing/`.

Стиль вдохновлён [Pixel Plays](https://github.com/amirmushichge/pixel-plays) (MIT, © 2026 Amir Mushich) — код написан с нуля, лицензия оригинала в `LICENSE-pixel-plays.txt`.
