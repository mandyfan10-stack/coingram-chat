# Выпуск CoinGram

Релизы собираются автоматически после отправки тега вида `vMAJOR.MINOR.PATCH`.

## Подготовка версии

```powershell
npm version 1.20.7 --no-git-tag-version
npm run release:verify -- v1.20.7
npm run lint
npm test
npm run build
```

Android `versionName` и монотонный `versionCode` вычисляются из `package.json`, поэтому вручную менять `android/app/build.gradle` больше не нужно.

После проверки версии:

```powershell
git add package.json package-lock.json
git commit -m "release: prepare v1.20.7"
git push origin main
git tag v1.20.7
git push origin v1.20.7
```

Тег запускает `.github/workflows/release.yml`. Workflow повторно проверяет версию, запускает линтер и тесты, публикует GitHub Pages, собирает подписанный APK и Windows-установщик, затем создаёт GitHub Release.

## Android signing key

Локальные файлы находятся в `android/keystores/` и исключены из Git. Сделайте зашифрованную резервную копию:

- `coingram-release.p12`;
- `signing.properties`.

APK из релиза `v1.20.5` был подписан временным debug-ключом. Перед установкой первой постоянной release-сборки `v1.20.6` старый APK потребуется удалить; дальнейшие версии будут обновляться поверх приложения без удаления.

Потеря ключа не позволит выпускать обновления, устанавливаемые поверх предыдущей release-сборки. GitHub Actions использует секреты `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` и `ANDROID_KEY_PASSWORD`.

## Подпись Windows

Workflow готов к Authenticode-подписи. После получения доверенного PFX-сертификата добавьте секреты:

- `WINDOWS_CERTIFICATE_BASE64` — Base64-содержимое PFX;
- `WINDOWS_CERTIFICATE_PASSWORD` — пароль PFX.

Пока этих секретов нет, EXE собирается без доверенной подписи и Windows SmartScreen может показывать предупреждение.