# Live E2E: два пользователя и WebRTC

Тест `tests/e2e/two-user-call.spec.mjs` запускает два изолированных браузерных контекста, входит под двумя QA-пользователями, открывает личный чат, принимает аудиозвонок, дожидается установленного WebRTC-соединения и завершает звонок.

Тест намеренно не регистрирует и не удаляет пользователей. Для него нужны две постоянные QA-учётки с уже настроенным E2EE. Добавьте в GitHub Actions Secrets:

- `E2E_USER_A`
- `E2E_PASSWORD_A`
- `E2E_ENCRYPTION_PASSWORD_A`
- `E2E_USER_B`
- `E2E_PASSWORD_B`
- `E2E_ENCRYPTION_PASSWORD_B`

QA-пользователи должны иметь разные никнеймы. Личный чат может уже существовать; если его нет, тест создаст его через обычный интерфейс.

Локальный запуск:

```powershell
$env:E2E_USER_A='qa_user_a'
$env:E2E_PASSWORD_A='...'
$env:E2E_ENCRYPTION_PASSWORD_A='...'
$env:E2E_USER_B='qa_user_b'
$env:E2E_PASSWORD_B='...'
$env:E2E_ENCRYPTION_PASSWORD_B='...'
npm run test:e2e
```

Без этих переменных live-тест помечается как пропущенный. Обычные unit/contract тесты продолжают запускаться командой `npm test`.
