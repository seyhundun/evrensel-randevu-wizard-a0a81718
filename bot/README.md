# VFS Global Randevu Takip Botu v8.0

Bu bot, VFS Global sitesinde randevu kontrol eder ve IP rotasyonu ile engelleri aşar.

## Kurulum

```bash
cd bot
npm install
```

## IP Rotasyonu Kurulumu (10 IP)

### 1. microsocks kur (her IP için SOCKS5 proxy)

```bash
sudo apt install -y build-essential git
git clone https://github.com/rofl0r/microsocks.git
cd microsocks && make && sudo cp microsocks /usr/local/bin/
```

### 2. Her IP için microsocks başlat

```bash
# IP'lerinizi buraya yazın
IPS=("1.2.3.4" "1.2.3.5" "1.2.3.6" "1.2.3.7" "1.2.3.8" "1.2.3.9" "1.2.3.10" "1.2.3.11" "1.2.3.12" "1.2.3.13")
PORT=10800

for i in "${!IPS[@]}"; do
  P=$((PORT + i))
  microsocks -i 127.0.0.1 -p $P -o ${IPS[$i]} &
  echo "microsocks: 127.0.0.1:$P -> ${IPS[$i]}"
done
```

### 3. PM2 ile kalıcı yap

`microsocks-start.sh` dosyası oluşturun (yukarıdaki script) ve:
```bash
pm2 start microsocks-start.sh --name microsocks-proxies
pm2 start index.js --name vfs-bot
pm2 save && pm2 startup
```

## Ortam Değişkenleri (.env)

```
IP_LIST=1.2.3.4,1.2.3.5,1.2.3.6
CAPTCHA_API_KEY=2captcha_api_anahtariniz
CAPSOLVER_API_KEY=CAP-xxxxxxxxxxxx
CAPTCHA_PROVIDER=auto
IP_BAN_DURATION_MS=1800000
```

> **CAPTCHA_PROVIDER** seçenekleri:
> - `auto` (varsayılan): Önce capsolver dener, başarısız olursa 2captcha'ya düşer
> - `capsolver`: Yalnızca capsolver kullanır
> - `2captcha`: Yalnızca 2captcha kullanır

> **Not:** `IP_LIST` virgülle ayrılmış VDS IP adresleriniz. Bot engellenince otomatik olarak sonraki IP'ye geçer.
