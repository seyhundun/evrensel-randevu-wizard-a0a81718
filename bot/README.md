# VFS Global Randevu Takip Botu

Bu bot, VFS Global sitesinde Fransa-Ankara turist vizesi randevusu kontrol eder ve sonuçları dashboard'a bildirir.

## Kurulum

```bash
cd bot
npm install
```

## Çalıştırma

```bash
node index.js
```

## VPS'te Sürekli Çalıştırma (PM2)

```bash
npm install -g pm2
pm2 start index.js --name vfs-bot
pm2 save
pm2 startup
```

## Ortam Değişkenleri (.env)

Bot klasöründe bir `.env` dosyası oluşturun:

```
VFS_EMAIL=vfs_hesap_emailiniz
VFS_PASSWORD=vfs_hesap_sifreniz
```

> **Not:** VFS Global hesabınızın email ve şifresini girmeniz gerekir.
