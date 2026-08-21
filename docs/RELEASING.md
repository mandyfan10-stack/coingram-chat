# Выпуск CoinGram

Релизы собираются автоматически после отправки тега вида `vMAJOR.MINOR.PATCH`.

## 1. Поднимите версию в `package.json` и верифицируйте:
   ```bash
   npm version 1.20.23 --no-git-tag-version
   npm run release:verify -- v1.20.23
   ```

2. Запустите полный локальный цикл проверок:
   ```bash
   npm run lint
   npm test
   npm run build
   npm run deploy
   ```

3. Зафиксируйте коммит и запушьте в `main`:
   ```bash
   git add package.json docs/ scripts/
   git commit -m "release: prepare v1.20.23"
   git push origin main
   git tag v1.20.23
   git push origin v1.20.23
   ```

Тег запускает `.github/workflows/release.yml`. Workflow повторно проверяет версию, запускает линтер и тесты, публикует GitHub Pages, собирает подписанный APK и Windows-установщик, затем создаёт GitHub Release.

## Android signing key

Локальные файлы: `android/keystores/` (gitignored). Полная инструкция: [SIGNING.md](./SIGNING.md).

```powershell
powershell -File scripts/backup-android-keystore.ps1
powershell -File scripts/sync-android-signing-secrets.ps1
```

Зашифрованный бэкап пишется в `%USERPROFILE%\Documents\Coingram-secure-backups\`. **Скопируйте `.bin` + `.meta.json` с этой машины** (USB / второй vault).

APK из релиза `v1.20.5` был подписан временным debug-ключом. Перед установкой первой постоянной release-сборки `v1.20.7` старый APK потребуется удалить; дальнейшие версии обновляются поверх.

Потеря ключа блокирует обновления поверх release-сборок. CI: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.

## Подпись Windows

Нужен **купленный** OV/EV code-signing сертификат (или Azure Trusted Signing). Self-signed SmartScreen не убирает.

После получения PFX:

```powershell
powershell -File scripts/setup-windows-signing-secrets.ps1 -PfxPath C:\path\to\codesign.pfx
```

Секреты: `WINDOWS_CERTIFICATE_BASE64`, `WINDOWS_CERTIFICATE_PASSWORD`.  
Пока секретов нет — EXE **unsigned**, SmartScreen предупреждает. Подробности: [SIGNING.md](./SIGNING.md).
