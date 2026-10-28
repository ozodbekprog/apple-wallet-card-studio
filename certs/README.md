# Sertifikat (imzolash)

Apple Wallet `.pkpass` fayli **Apple Pass Type ID sertifikati** bilan imzolanmasa iPhone’ga o‘rnatilmaydi.
Sertifikat bo‘lmasa studio ishlayveradi, lekin natija `karta-imzosiz.zip` bo‘ladi (faqat tuzilmani tekshirish uchun).

## 1. Pass Type ID yaratish

1. [developer.apple.com/account](https://developer.apple.com/account) → **Certificates, Identifiers & Profiles**
2. **Identifiers → Pass Type IDs → +**
3. Identifier: `pass.com.<sizning-domen>.card` (masalan `pass.com.xoshimov.card`)
4. **Certificates → + → Pass Type ID Certificate** → yuqoridagi ID ni tanlang
5. CSR: Keychain Access → **Certificate Assistant → Request a Certificate From a Certificate Authority** → *Saved to disk*
6. CSR ni yuklang, `.cer` ni yuklab oling va ikki marta bosib Keychain’ga qo‘shing
7. Keychain’da sertifikatni **My Certificates** dan topib, `.p12` qilib eksport qiling (parol qo‘ying)

> Apple Developer Program (yiliga $99) kerak. Bepul akkaunt bilan Pass Type ID berilmaydi.

## 2. Fayllarni shu papkaga qo‘yish

```bash
# pass sertifikati va kalit
openssl pkcs12 -in pass.p12 -clcerts -nokeys -out certs/pass.pem
openssl pkcs12 -in pass.p12 -nocerts -nodes  -out certs/pass.key

# Apple WWDR G4 (https://www.apple.com/certificateauthority/)
openssl x509 -inform der -in AppleWWDRCAG4.cer -out certs/wwdr.pem
```

Natijada papkada uchta fayl bo‘lishi kerak:

```
certs/pass.pem
certs/pass.key
certs/wwdr.pem
```

## 3. config.json

`certs/config.example.json` ni `certs/config.json` ga nusxalab, o‘zingizning qiymatlaringizni yozing:

```json
{
  "passTypeIdentifier": "pass.com.xoshimov.card",
  "teamIdentifier": "ABCDE12345",
  "organizationName": "Xoshimov Group"
}
```

`teamIdentifier` — Apple Developer akkauntingizdagi 10 belgili Team ID.

## 4. Tekshirish

Serverni qayta ishga tushiring:

```bash
npm start
```

Yuqoridagi nishonda **sertifikat bor** yozilsa, yuklanadigan fayl `.pkpass` bo‘ladi.

> `certs/` ichidagi kalitlar `.gitignore` da — ularni hech qachon GitHub’ga yubormang.
