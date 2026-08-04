# APK / IPA üretimi

## ⚠️ Önce bunu oku: proje yolundaki `İ` yerel build'i bozuyor

Bu depo `D:\Projeler\CİKLET\ciklet-mobile` altında duruyor. Klasör adındaki
**`İ` (U+0130, Türkçe noktalı büyük I)** karakteri `npx expo prebuild`
adımını Windows'ta bozuyor:

```
✖ Prebuild failed
AssertionError: [android.dangerous]: withAndroidDangerousBaseMod:
Project file "MainApplication" does not exist in android project
```

**Teşhis:** Şablon tarball'ı geçici dizine sorunsuz açılıyor
(`expo:utils:tar` günlüğü bunu gösteriyor), ancak geçici dizinden proje
köküne **kopyalama adımı `android/` ağacını hiç taşımıyor** — dizin boş
kalıyor, ardından paket yeniden adlandırma `MainApplication`'ı bulamayıp
patlıyor.

**Doğrulama:** Aynı proje ASCII bir yola (`C:\Users\<kullanıcı>\ciklet-ascii`)
kopyalanıp `npm install` sonrası prebuild çalıştırıldığında **sorunsuz
tamamlanıyor**. Değişken tek: yol.

Not: bu yalnızca **yerel** native build'i etkiler. EAS bulut build'i kaynağı
Linux'a yükleyip orada derlediği için bu sorundan etkilenmez.

### Kalıcı çözüm (önerilen)

Üst klasörü ASCII yap — tek işlemde tüm Ciklet depolarını düzeltir:

```
D:\Projeler\CİKLET   →   D:\Projeler\CIKLET
```

Bunu yapmadan önce tüm editör/terminal/Metro süreçlerini kapat.

### Geçici çözüm

Yeniden adlandırmak istemiyorsan `scripts/build-apk.ps1` betiği projeyi
ASCII bir çalışma dizinine kopyalayıp orada derler ve APK'yı geri getirir.

---

## Yerel release APK

### Gereksinimler (bir kez)

| Araç | Sürüm | Not |
| --- | --- | --- |
| JDK | **17** | Zorunlu. 21 ile Gradle uyumsuzluk çıkarabiliyor. |
| Android SDK | Platform 35 + Build-Tools 35 | Android Studio ile gelir. |

Kurulum:

1. **JDK 17** — [Microsoft OpenJDK 17](https://learn.microsoft.com/java/openjdk/download)
   veya `winget install Microsoft.OpenJDK.17`
2. **Android Studio** — [developer.android.com/studio](https://developer.android.com/studio)
   Kurulum sihirbazında "Android SDK" ve "Android SDK Platform" işaretli kalsın.
3. Ortam değişkenleri (PowerShell, kalıcı):

```powershell
[Environment]::SetEnvironmentVariable(
  "ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
[Environment]::SetEnvironmentVariable(
  "JAVA_HOME", "C:\Program Files\Microsoft\jdk-17.0.13.11-hotspot", "User")
```

Ardından **terminali kapatıp yeniden aç**. Doğrulama:

```powershell
java -version      # 17.x görmelisin
echo $env:ANDROID_HOME
```

### Derleme

```powershell
.\scripts\build-apk.ps1
```

Betik sırasıyla:
1. Projeyi ASCII bir çalışma dizinine kopyalar (yukarıdaki `İ` sorunu),
2. `npx expo prebuild --platform android` çalıştırır,
3. `gradlew assembleRelease` ile APK üretir,
4. APK'yı `dist/ciklet-<sürüm>.apk` olarak geri kopyalar.

İlk derleme 20–40 dk sürer (Gradle bağımlılıkları indirir); sonrakiler
birkaç dakika.

### İmzalama hakkında

Release APK, Expo şablonunun **debug keystore**'uyla imzalanır. Cihazda
denemek için yeterlidir; **Play Store'a yüklenemez**. Mağaza sürümü için
EAS'in yönettiği keystore kullanılır (`eas build --profile production`).

---

## EAS bulut build

Yerel araç kurmak istemiyorsan:

```powershell
npx eas-cli login
npx eas-cli build --profile preview --platform android
```

`preview` profili `eas.json`'da `buildType: apk` ile tanımlı — çıktı
doğrudan telefona kurulabilir. Build bitince EAS bir indirme linki ve QR
kod verir.

> `production` profili bilerek `app-bundle` üretir; Play Store'un istediği
> format budur ve telefona doğrudan kurulamaz.

---

## Backend seçimi

| Profil | `EXPO_PUBLIC_API_URL` | Kullanım |
| --- | --- | --- |
| `.env.production` (yerel release, EAS `preview`/`production`) | `https://ciklet.xyz` | APK tek başına çalışır |
| `.env` (Metro / EAS `development`) | LAN IP | Telefon aynı Wi-Fi'da, bilgisayar açık olmalı |

Yerel release derlemesi `NODE_ENV=production` ile çalıştığı için
`.env.production` otomatik olarak `.env`'in yerine geçer.

---

## Cihazda doğrulanması gerekenler

Bu ikisi yalnızca gerçek cihazda görülebilir; CI'da tip ve bundle
kontrolünden geçiyor olmaları yeterli değil:

- **Sesli kanal** — mikrofon izni akışı, LiveKit bağlantısı, konuşan
  göstergesi, arka planda ses devamlılığı
- **Aktivite köprüsü** — WebView içindeki iframe ile `postMessage` rölesi
  ve `AUTHORIZE` komutunun gerçek bir aktivite uygulamasıyla el sıkışması
