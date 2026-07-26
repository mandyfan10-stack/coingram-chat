# Live E2E: два пользователя, сообщения и WebRTC

Live-набор запускает два изолированных браузерных контекста:

- `tests/e2e/two-user-call.spec.mjs` проверяет установку и завершение WebRTC-звонка;
- `tests/e2e/two-user-read-receipt.spec.mjs` проверяет отправку, получение, прочтение, перезагрузку обоих клиентов и сохранение двойной галочки.

Тесты намеренно не регистрируют и не удаляют пользователей. Для них нужны две постоянные QA-учётки с уже настроенным E2EE. Добавьте в GitHub Actions Secrets:

- `E2E_USER_A`
- `E2E_PASSWORD_A`
- `E2E_ENCRYPTION_PASSWORD_A`
- `E2E_USER_B`
- `E2E_PASSWORD_B`
- `E2E_ENCRYPTION_PASSWORD_B`

QA-пользователи должны иметь разные никнеймы. Личный чат может уже существовать; если его нет, тест создаст его через обычный интерфейс. Тест квитанций удаляет созданное им служебное сообщение после успешной проверки.

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

Без этих переменных live-тесты помечаются как пропущенные. Обычные unit/contract тесты продолжают запускаться командой `npm test`.