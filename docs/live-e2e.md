# Live E2E: два пользователя, сообщения и WebRTC

Live-набор запускает два изолированных браузерных контекста:

- `tests/e2e/two-user-call.spec.mjs` — установка WebRTC-звонка, **live remote audio tracks** (fake media devices), hangup;
- `tests/e2e/two-user-read-receipt.spec.mjs` — отправка, получение, прочтение, reload, двойная галочка.

Тесты намеренно не регистрируют и не удаляют пользователей. Для них нужны две постоянные QA-учётки с уже настроенным E2EE.

## GitHub Actions Secrets

Добавьте в **Settings → Secrets and variables → Actions** (и для CI `live-e2e`, и для локального прогона через env):

| Secret | Описание |
|--------|----------|
| `E2E_USER_A` | username первого QA-пользователя |
| `E2E_PASSWORD_A` | пароль входа A |
| `E2E_ENCRYPTION_PASSWORD_A` | пароль разблокировки E2EE A |
| `E2E_USER_B` | username второго QA-пользователя (≠ A) |
| `E2E_PASSWORD_B` | пароль входа B |
| `E2E_ENCRYPTION_PASSWORD_B` | пароль разблокировки E2EE B |

Опционально:

| Variable / env | Описание |
|----------------|----------|
| `E2E_BASE_URL` | Готовый URL вместо `vite preview` (например staging) |

Без `E2E_USER_*` live-тесты **пропускаются** (`test.skip`). Unit/contract (`npm test`) не зависят от секретов.

Workflow: `.github/workflows/ci.yml` → job `live-e2e` (запускается только если secrets заданы).

## Локальный запуск

```powershell
$env:E2E_USER_A='qa_user_a'
$env:E2E_PASSWORD_A='...'
$env:E2E_ENCRYPTION_PASSWORD_A='...'
$env:E2E_USER_B='qa_user_b'
$env:E2E_PASSWORD_B='...'
$env:E2E_ENCRYPTION_PASSWORD_B='...'
npm run test:e2e
```

Playwright поднимает Chromium с:

- `--use-fake-ui-for-media-stream`
- `--use-fake-device-for-media-stream`

и разрешениями `microphone` / `camera`.

## Ручной чеклист: offline queue

Unit-покрытие: `tests/offlineQueue.test.mjs` (enqueue/load, network errors, media upload path).

На реальном устройстве / двух вкладках с live Supabase:

1. Войти двумя пользователями, открыть личный чат.
2. На отправителе: DevTools → Network → **Offline** (или airplane mode).
3. Отправить текст и (опционально) фото/голосовое.
4. Убедиться: сообщение в UI как pending / offline, без «пропажи» из списка.
5. Вернуть Online.
6. Сообщение доставляется (pending снимается), на втором клиенте появляется в Realtime.
7. Reload отправителя: история и delivered-статус сохраняются.

## Ручной чеклист: WebRTC media (физические устройства)

Автоматизация закрывает signaling + fake media path. Для «настоящего» A/V:

1. Два браузера / два телефона (HTTPS или localhost).
2. Разрешить mic (и cam при видео).
3. A звонит B → B принимает.
4. Обе стороны слышат/видят (не только таймер звонка).
5. Mute / unmute, (опционально) camera / screen share.
6. Hangup с любой стороны → overlay закрывается у обоих, нет «зависшего» звонка.

## Ручной чеклист: group call (smoke)

1. Создать группу ≥2 участников (лучше 3).
2. Старт группового звонка.
3. Presence: участники появляются в overlay.
4. Mesh: каждый слышит остальных (или fake feeds в devtools).
5. Выход одного участника не рвёт остальных.

Contract-тесты mesh/presence: `tests/groupCallContracts.test.mjs`.

## Unit / contract без live secrets

```bash
npm test          # E2EE crypto + offline queue + contracts
npm run typecheck
```

E2EE regression (wrong password, reload re-derive, safety UI): `tests/e2eeRegression.test.mjs`.
