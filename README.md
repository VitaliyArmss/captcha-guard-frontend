# CAPTCHA Guard — Frontend

React-интерфейс тестового сайта CAPTCHA Guard. Приложение отображает Cloudflare Turnstile, отправляет полученный токен на backend и показывает защищённое сообщение после успешной серверной проверки.

## Технологии

- React
- Vite
- Cloudflare Turnstile JavaScript API
- JavaScript (ES modules)

## Как это работает

1. При загрузке страницы frontend запрашивает `GET /api/captcha/config`.
2. Получает публичный `siteKey` и проверяет, настроен ли backend.
3. Динамически загружает скрипт Cloudflare Turnstile и создаёт виджет в контейнере страницы.
4. После успешной проверки получает токен через callback Turnstile.
5. При нажатии кнопки отправляет токен в `POST /api/captcha/verify`.
6. Если backend подтверждает проверку, приложение отображает возвращённое защищённое сообщение.

При ошибках, истечении срока действия токена или тайм-ауте frontend обновляет статус и позволяет повторить проверку.
## Связанные репозитории

- [Основной репозиторий со скриптом](https://github.com/VitaliyArmss/captcha-guard-script)
- [Backend API](https://github.com/VitaliyArmss/captcha-guard-backend)
