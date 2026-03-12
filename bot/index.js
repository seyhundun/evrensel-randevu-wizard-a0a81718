/**
 * VFS Global Randevu Takip Botu
 * 
 * Bu script:
 * 1. Dashboard API'den aktif takip görevlerini çeker
 * 2. VFS Global sitesine giriş yapar
 * 3. Randevu müsaitliğini kontrol eder
 * 4. Sonuçları API'ye bildirir
 * 5. Belirli aralıklarla tekrarlar
 */

require("dotenv").config();
const puppeteer = require("puppeteer");

// ==================== YAPILANDIRMA ====================
const CONFIG = {
  // Dashboard API endpoint'i
  API_URL: "https://ocrpzwrsyiprfuzsyivf.supabase.co/functions/v1/bot-api",
  API_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jcnB6d3JzeWlwcmZ1enN5aXZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMDQ1NzksImV4cCI6MjA4ODg4MDU3OX0.5MzKGm6byd1zLxjgxaXyQq5VfPFo_CE2MhcXijIRarc",

  // VFS Global
  VFS_URL: "https://visa.vfsglobal.com/tur/tr/fra/login",
  VFS_EMAIL: process.env.VFS_EMAIL || "",
  VFS_PASSWORD: process.env.VFS_PASSWORD || "",

  // Tarayıcı ayarları
  HEADLESS: true,
  SLOW_MO: 50, // ms - insan benzeri gecikme
};

// ==================== YARDIMCI FONKSİYONLAR ====================

/** Rastgele gecikme (anti-bot önlemi) */
function randomDelay(min = 1000, max = 3000) {
  const ms = Math.floor(Math.random() * (max - min) + min);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** API'den aktif görevleri çek */
async function fetchActiveConfigs() {
  try {
    const res = await fetch(CONFIG.API_URL, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CONFIG.API_KEY}`,
        apikey: CONFIG.API_KEY,
      },
    });
    const data = await res.json();
    if (data.ok) return data.configs;
    console.error("API hatası:", data.error);
    return [];
  } catch (err) {
    console.error("API bağlantı hatası:", err.message);
    return [];
  }
}

/** API'ye sonuç bildir */
async function reportResult(configId, status, message = "", slotsAvailable = 0) {
  try {
    const res = await fetch(CONFIG.API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CONFIG.API_KEY}`,
        apikey: CONFIG.API_KEY,
      },
      body: JSON.stringify({
        config_id: configId,
        status,
        message,
        slots_available: slotsAvailable,
      }),
    });
    const data = await res.json();
    console.log(`  [API] ${status}: ${data.message || data.error}`);
  } catch (err) {
    console.error("  [API] Bildirim hatası:", err.message);
  }
}

/** İnsan benzeri yazma */
async function humanType(page, selector, text) {
  await page.click(selector);
  await randomDelay(300, 600);
  for (const char of text) {
    await page.keyboard.type(char, { delay: Math.random() * 150 + 50 });
  }
}

// ==================== ANA BOT DÖNGÜSÜ ====================

async function checkAppointments(config) {
  const { id, country, city, visa_category, check_interval, applicants } = config;
  const timestamp = new Date().toLocaleTimeString("tr-TR");

  console.log(`\n[${timestamp}] Kontrol başlatılıyor...`);
  console.log(`  Ülke: ${country} | Şehir: ${city} | Kategori: ${visa_category}`);
  console.log(`  Başvuru sahipleri: ${applicants.length}`);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: CONFIG.HEADLESS ? "new" : false,
      slowMo: CONFIG.SLOW_MO,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
        "--window-size=1920,1080",
      ],
    });

    const page = await browser.newPage();

    // Anti-bot: User-Agent ve WebDriver gizleme
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
      Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, "languages", { get: () => ["tr-TR", "tr", "en-US", "en"] });
    });

    await page.setViewport({ width: 1920, height: 1080 });

    // 1. VFS Global giriş sayfasına git
    console.log("  [1/4] Giriş sayfası yükleniyor...");
    await page.goto(CONFIG.VFS_URL, { waitUntil: "networkidle2", timeout: 30000 });
    await randomDelay(2000, 4000);

    // 2. Giriş yap
    console.log("  [2/4] Giriş yapılıyor...");
    try {
      // Email alanı
      await page.waitForSelector('input[type="email"], input[name="email"], #email', { timeout: 10000 });
      const emailSelector = await page.$('input[type="email"]') || await page.$('input[name="email"]') || await page.$("#email");
      if (emailSelector) {
        await humanType(page, 'input[type="email"], input[name="email"], #email', CONFIG.VFS_EMAIL);
      }
      await randomDelay(500, 1000);

      // Şifre alanı
      await humanType(page, 'input[type="password"]', CONFIG.VFS_PASSWORD);
      await randomDelay(500, 1000);

      // Giriş butonu
      await page.click('button[type="submit"], .btn-primary, #btnSubmit');
      await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {});
      await randomDelay(3000, 5000);
    } catch (loginErr) {
      console.log("  [!] Giriş formu bulunamadı veya zaten giriş yapılmış, devam ediliyor...");
    }

    // 3. Randevu sayfasına git
    console.log("  [3/4] Randevu sayfası kontrol ediliyor...");
    await randomDelay(2000, 3000);

    // VFS Global'in randevu sayfası yapısına göre kontrol et
    // NOT: VFS Global sık sık arayüz değiştirdiği için
    // bu seçicilerin güncellenmesi gerekebilir
    try {
      // "Yeni Başvuru" veya "Book Appointment" butonu ara
      const bookButton = await page.$(
        'a[href*="appointment"], button:has-text("New Application"), ' +
        'a:has-text("Book Appointment"), a:has-text("Randevu"), ' +
        '.appointment-btn, #btnNewApp'
      );

      if (bookButton) {
        await bookButton.click();
        await randomDelay(3000, 5000);
      }

      // Sayfa içeriğini kontrol et
      const pageContent = await page.content();
      const bodyText = await page.evaluate(() => document.body.innerText);

      // Randevu müsait mi kontrol et
      const noAppointmentPhrases = [
        "no appointment",
        "no available",
        "currently no date",
        "randevu bulunmamaktadır",
        "müsait randevu yok",
        "no open schedule",
        "fully booked",
        "no slot",
      ];

      const appointmentFoundPhrases = [
        "select date",
        "available slot",
        "tarih seçin",
        "müsait",
        "available appointment",
        "open slot",
      ];

      const lowerText = bodyText.toLowerCase();

      const noAppointment = noAppointmentPhrases.some((p) => lowerText.includes(p));
      const hasAppointment = appointmentFoundPhrases.some((p) => lowerText.includes(p));

      if (hasAppointment && !noAppointment) {
        // 🎉 RANDEVU BULUNDU!
        console.log("  ✅ RANDEVU BULUNDU!");

        // Ekran görüntüsü al
        await page.screenshot({ path: `found_${Date.now()}.png`, fullPage: true });

        await reportResult(id, "found", "Randevu müsait! Hemen giriş yapın.", 1);
        return true; // Bulundu
      } else {
        console.log("  ❌ Randevu bulunamadı.");
        await reportResult(id, "checking", "Müsait randevu yok, kontrol devam ediyor.");
        return false;
      }
    } catch (checkErr) {
      console.error("  [!] Kontrol hatası:", checkErr.message);
      await page.screenshot({ path: `error_${Date.now()}.png` }).catch(() => {});
      await reportResult(id, "error", `Kontrol hatası: ${checkErr.message}`);
      return false;
    }
  } catch (err) {
    console.error("  [!] Genel hata:", err.message);
    await reportResult(id, "error", `Bot hatası: ${err.message}`);
    return false;
  } finally {
    if (browser) await browser.close();
  }
}

// ==================== ANA DÖNGÜ ====================

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  VFS Global Randevu Takip Botu");
  console.log("═══════════════════════════════════════════");

  if (!CONFIG.VFS_EMAIL || !CONFIG.VFS_PASSWORD) {
    console.error("\n❌ VFS_EMAIL ve VFS_PASSWORD .env dosyasında tanımlanmalı!");
    console.log("   bot/.env dosyası oluşturun:");
    console.log("   VFS_EMAIL=email@example.com");
    console.log("   VFS_PASSWORD=sifreniz");
    process.exit(1);
  }

  while (true) {
    try {
      // API'den aktif görevleri çek
      const configs = await fetchActiveConfigs();

      if (configs.length === 0) {
        console.log("\n⏸  Aktif takip görevi yok. 60 saniye sonra tekrar kontrol edilecek...");
        await new Promise((r) => setTimeout(r, 60000));
        continue;
      }

      for (const config of configs) {
        const found = await checkAppointments(config);

        if (found) {
          console.log("\n🎉🎉🎉 RANDEVU BULUNDU! Dashboard'u kontrol edin! 🎉🎉🎉");
          // Bulunduktan sonra bu config için durmayacak,
          // API zaten config'i deaktif edecek
        }

        // İki kontrol arası rastgele gecikme
        const interval = (config.check_interval || 120) * 1000;
        const jitter = Math.floor(Math.random() * 30000); // 0-30s rastgele ek
        const waitTime = interval + jitter;

        console.log(`\n⏳ Sonraki kontrol: ${Math.round(waitTime / 1000)} saniye sonra...`);
        await new Promise((r) => setTimeout(r, waitTime));
      }
    } catch (err) {
      console.error("Ana döngü hatası:", err.message);
      await new Promise((r) => setTimeout(r, 30000));
    }
  }
}

main();
