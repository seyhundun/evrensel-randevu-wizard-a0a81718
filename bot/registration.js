const CONFIG = global.CONFIG;
const apiHeaders = global.apiHeaders;
const delay = global.delay;
const takeScreenshotBase64 = global.takeScreenshotBase64;
const QUEUE_MAX_WAIT_MS = Number(process.env.QUEUE_MAX_WAIT_MS || 360000);

async function fetchPendingRegistrations() {
  try {
    const res = await fetch(CONFIG.API_URL, {
      method: "POST",
      headers: apiHeaders,
      body: JSON.stringify({ action: "get_pending_registrations" }),
    });
    const data = await res.json();
    return data.ok ? (data.accounts || []) : [];
  } catch (err) {
    console.error("  [REG] Kayıt listesi hatası:", err.message);
    return [];
  }
}

async function setRegistrationOtpNeeded(accountId, otpType) {
  try {
    await fetch(CONFIG.API_URL, {
      method: "POST",
      headers: apiHeaders,
      body: JSON.stringify({
        action: "set_registration_otp_needed",
        account_id: accountId,
        otp_type: otpType,
      }),
    });
    console.log(`  [REG] 📱 ${otpType.toUpperCase()} OTP bekleniyor`);
  } catch (err) {
    console.error("  [REG] OTP istek hatası:", err.message);
  }
}

async function getRegistrationOtp(accountId) {
  try {
    const res = await fetch(CONFIG.API_URL, {
      method: "POST",
      headers: apiHeaders,
      body: JSON.stringify({ action: "get_registration_otp", account_id: accountId }),
    });
    const data = await res.json();
    return data.registration_otp || null;
  } catch (err) {
    console.error("  [REG] OTP okuma hatası:", err.message);
    return null;
  }
}

async function completeRegistration(accountId, success) {
  try {
    await fetch(CONFIG.API_URL, {
      method: "POST",
      headers: apiHeaders,
      body: JSON.stringify({ action: "complete_registration", account_id: accountId, success }),
    });
    console.log(`  [REG] Kayıt ${success ? "✅ başarılı" : "❌ başarısız"}`);
  } catch (err) {
    console.error("  [REG] Kayıt sonuç hatası:", err.message);
  }
}

async function waitForRegistrationOtp(accountId, otpType, timeoutMs = 180000) {
  await setRegistrationOtpNeeded(accountId, otpType);
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const otp = await getRegistrationOtp(accountId);
    if (otp) {
      console.log(`  [REG] ✅ ${otpType} OTP alındı`);
      return otp;
    }
    const elapsed = Math.round((Date.now() - start) / 1000);
    console.log(`  [REG] ${otpType} OTP bekleniyor... ${elapsed}s/${Math.round(timeoutMs / 1000)}s`);
    await delay(4500, 6000);
  }

  return null;
}

function normalizePhone(v) {
  return String(v || "")
    .replace(/\D/g, "")
    .replace(/^90/, "")
    .replace(/^0+/, "")
    .slice(0, 10);
}

async function postRegError(account, page, reason) {
  try {
    let screenshotBase64 = null;
    if (page) screenshotBase64 = await takeScreenshotBase64(page);

    const cfgRes = await fetch(CONFIG.API_URL, { method: "GET", headers: apiHeaders });
    const cfgData = await cfgRes.json();
    const configId = cfgData?.configs?.[0]?.id;

    if (configId) {
      const body = {
        config_id: configId,
        status: "error",
        message: `[REG] ${reason} | Hesap: ${account.email}`,
        slots_available: 0,
      };
      if (screenshotBase64) body.screenshot_base64 = screenshotBase64;

      await fetch(CONFIG.API_URL, {
        method: "POST",
        headers: apiHeaders,
        body: JSON.stringify(body),
      });
    }

    if (screenshotBase64) console.log("  [REG] 📸 Hata screenshot gönderildi");
  } catch (e) {
    console.error("  [REG] Hata rapor gönderim hatası:", e.message);
  }
}

async function dismissCookieModal(page) {
  await delay(3000, 5000);

  try {
    const clicked = await page.evaluate(() => {
      const otBtn = document.getElementById('onetrust-accept-btn-handler');
      if (otBtn) { otBtn.click(); return 'onetrust-accept-btn'; }

      const allBtns = Array.from(document.querySelectorAll('button, a.button, [role="button"]'));
      const acceptKeywords = [
        'tüm tanımlama bilgilerini kabul et',
        'accept all cookies',
        'accept all',
        'tümünü kabul et',
      ];

      for (const btn of allBtns) {
        const txt = (btn.textContent || '').trim().toLowerCase();
        if (acceptKeywords.some(k => txt.includes(k))) {
          btn.click();
          return 'keyword:' + txt.substring(0, 40);
        }
      }

      for (const btn of allBtns) {
        const cls = (btn.className || '').toLowerCase();
        const id = (btn.id || '').toLowerCase();
        if (cls.includes('accept') || id.includes('accept')) {
          btn.click();
          return 'class/id:' + (cls || id).substring(0, 40);
        }
      }

      return null;
    });

    if (clicked) {
      console.log('  [REG] ✅ Cookie banner kapatıldı (' + clicked + ')');
      await delay(1500, 2500);
      return;
    }
  } catch {}

  try {
    const closedModal = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      for (const b of btns) {
        const t = (b.textContent || '').trim().toLowerCase();
        if (t.includes('confirm my choices') || t.includes('tercihlerimi onayla')) {
          b.click();
          return true;
        }
      }
      const closeBtn = document.querySelector('#onetrust-pc-sdk .ot-close-icon, .onetrust-close-btn-handler');
      if (closeBtn) { closeBtn.click(); return true; }
      return false;
    });
    if (closedModal) {
      console.log('  [REG] ✅ Privacy modal kapatıldı');
      await delay(1000, 1500);
    }
  } catch {}
}

async function selectTurkeyDialCode(page) {
  console.log('  [REG] Dial code seçimi başlıyor...');

  // Debug: Sayfadaki tüm select ve dropdown elemanlarını logla
  try {
    const debugInfo = await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      const selectInfo = selects.map((s, i) => {
        const opts = Array.from(s.options).slice(0, 5).map(o => `${o.value}|${o.textContent.trim().substring(0, 30)}`);
        return `select[${i}] name=${s.name} id=${s.id} class=${s.className.substring(0, 40)} opts=[${opts.join('; ')}]`;
      });

      // Angular mat-select veya custom dropdown kontrolleri
      const matSelects = Array.from(document.querySelectorAll('mat-select, [role="listbox"], [role="combobox"], .mat-select, ng-select, .ng-select'));
      const matInfo = matSelects.map((el, i) => `custom[${i}] tag=${el.tagName} class=${el.className.substring(0, 50)} id=${el.id}`);

      // Arama kodu label'ı yakınındaki elemanları bul
      const labels = Array.from(document.querySelectorAll('label, .mat-form-field-label, span'));
      const dialLabel = labels.find(l => {
        const t = (l.textContent || '').toLowerCase();
        return t.includes('arama kodu') || t.includes('dial code') || t.includes('country code');
      });
      let nearbyInfo = '';
      if (dialLabel) {
        const parent = dialLabel.closest('.form-group, .mat-form-field, .field-wrapper, div') || dialLabel.parentElement;
        if (parent) {
          nearbyInfo = `label_parent: tag=${parent.tagName} class=${parent.className.substring(0, 60)} innerHTML=${parent.innerHTML.substring(0, 200)}`;
        }
      }

      return { selectInfo, matInfo, nearbyInfo, labelFound: !!dialLabel };
    });
    console.log('  [REG] Debug selects:', JSON.stringify(debugInfo.selectInfo));
    console.log('  [REG] Debug custom:', JSON.stringify(debugInfo.matInfo));
    console.log('  [REG] Debug label:', debugInfo.nearbyInfo?.substring(0, 200));
    console.log('  [REG] Label found:', debugInfo.labelFound);
  } catch (e) {
    console.log('  [REG] Debug hatası:', e.message);
  }

  // ===== YÖNTEM 1: Native <select> - doğrudan value ile =====
  try {
    const selectResult = await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      for (const s of selects) {
        const opts = Array.from(s.options);
        // Turkey/Türkiye/90 ara
        for (const o of opts) {
          const txt = (o.textContent || '').toLowerCase();
          const val = (o.value || '').toLowerCase();
          if (txt.includes('turkey') || txt.includes('türkiye') || txt.includes('(90)') || txt.includes('+90') || val === '90' || val === '+90' || val.includes('turkey')) {
            s.value = o.value;
            s.dispatchEvent(new Event('change', { bubbles: true }));
            s.dispatchEvent(new Event('input', { bubbles: true }));
            // Angular
            const proto = Object.getPrototypeOf(s);
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set ||
              Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
            if (nativeInputValueSetter) {
              nativeInputValueSetter.call(s, o.value);
              s.dispatchEvent(new Event('change', { bubbles: true }));
              s.dispatchEvent(new Event('input', { bubbles: true }));
            }
            return 'native:' + o.textContent.trim().substring(0, 30);
          }
        }
      }
      return null;
    });
    if (selectResult) {
      console.log('  [REG] ✅ Dial code seçildi (' + selectResult + ')');
      await delay(500, 1000);
      return true;
    }
  } catch (e) {
    console.log('  [REG] Native select hatası:', e.message);
  }

  // ===== YÖNTEM 2: Puppeteer page.select ile =====
  try {
    const selectors = await page.$$('select');
    for (const sel of selectors) {
      const optionValue = await page.evaluate((s) => {
        const opts = Array.from(s.options);
        const match = opts.find(o => {
          const t = (o.textContent || '').toLowerCase();
          const v = (o.value || '').toLowerCase();
          return t.includes('turkey') || t.includes('türkiye') || t.includes('(90)') || t.includes('+90') || v === '90' || v === '+90' || v.includes('turkey');
        });
        return match ? match.value : null;
      }, sel);

      if (optionValue) {
        // Puppeteer select
        const selectId = await page.evaluate(s => s.id || s.name || s.className, sel);
        await sel.select(optionValue);
        console.log('  [REG] ✅ Dial code page.select ile seçildi (val=' + optionValue + ')');
        await delay(500, 800);
        return true;
      }
    }
  } catch (e) {
    console.log('  [REG] page.select hatası:', e.message);
  }

  // ===== YÖNTEM 3: Angular/Custom dropdown - click to open, then select =====
  try {
    console.log('  [REG] Custom dropdown deneniyor...');

    // "Arama kodu" label'ına yakın tıklanabilir element bul
    const clickedDropdown = await page.evaluate(() => {
      // Tüm olası dropdown trigger'ları
      const triggers = Array.from(document.querySelectorAll(
        'mat-select, ng-select, [role="combobox"], [role="listbox"], ' +
        '.mat-select, .ng-select, .custom-select, .dropdown-toggle, ' +
        'div[class*="select"], div[class*="dropdown"], span[class*="select"]'
      ));

      // Arama kodu label'ını bul
      const allText = Array.from(document.querySelectorAll('label, span, div, p'));
      const dialLabel = allText.find(el => {
        const t = (el.textContent || '').trim().toLowerCase();
        return (t.includes('arama kodu') || t === 'arama kodu' || t.includes('dial code') || t.includes('country code')) && t.length < 50;
      });

      if (dialLabel) {
        // Label'ın parent container'ında tıklanabilir element bul
        const container = dialLabel.closest('.form-group, .field-group, .form-field, .mat-form-field, div') || dialLabel.parentElement;
        if (container) {
          // Container içinde select, mat-select, veya herhangi bir tıklanabilir dropdown
          const clickable = container.querySelector('select, mat-select, ng-select, [role="combobox"], [role="listbox"], .mat-select-trigger, div[class*="select"], .dropdown-toggle');
          if (clickable) {
            clickable.click();
            return 'label-based:' + clickable.tagName + '.' + (clickable.className || '').substring(0, 30);
          }
          // Container'ın kendisini tıkla
          container.click();
          return 'container-click:' + container.tagName;
        }
      }

      // Fallback: İlk dropdown-like elementi tıkla
      for (const t of triggers) {
        t.click();
        return 'trigger:' + t.tagName + '.' + (t.className || '').substring(0, 30);
      }

      return null;
    });

    if (clickedDropdown) {
      console.log('  [REG] Dropdown açıldı: ' + clickedDropdown);
      await delay(1000, 2000);

      // Açılan listeden Turkey/Türkiye seç
      const selected = await page.evaluate(() => {
        const options = Array.from(document.querySelectorAll(
          'mat-option, ng-option, [role="option"], li, .option, .dropdown-item, .mat-option'
        ));
        for (const opt of options) {
          const txt = (opt.textContent || '').toLowerCase();
          if (txt.includes('turkey') || txt.includes('türkiye') || txt.includes('(90)') || txt.includes('+90')) {
            opt.click();
            return 'option:' + opt.textContent.trim().substring(0, 30);
          }
        }
        return null;
      });

      if (selected) {
        console.log('  [REG] ✅ Custom dropdown: ' + selected);
        await delay(500, 1000);
        return true;
      } else {
        console.log('  [REG] ⚠ Dropdown açıldı ama Turkey bulunamadı');
      }
    }
  } catch (e) {
    console.log('  [REG] Custom dropdown hatası:', e.message);
  }

  // ===== YÖNTEM 4: Keyboard ile arama - select'e focus verip "tur" yaz =====
  try {
    const selects = await page.$$('select');
    if (selects.length > 0) {
      // İlk select'e focus ver (genelde dial code ilk select'tir)
      for (const sel of selects) {
        await sel.click();
        await delay(300, 500);
        // "Turkey" yazarak aramayı dene
        await page.keyboard.type('Tur', { delay: 100 });
        await delay(500, 800);
        await page.keyboard.press('Enter');
        await delay(300, 500);

        // Seçildi mi kontrol et
        const currentVal = await page.evaluate(s => {
          const selected = s.options[s.selectedIndex];
          return selected ? selected.textContent.trim() : '';
        }, sel);

        if (currentVal.toLowerCase().includes('turkey') || currentVal.toLowerCase().includes('türkiye') || currentVal.includes('90')) {
          console.log('  [REG] ✅ Keyboard ile seçildi: ' + currentVal);
          return true;
        }
      }
    }
  } catch (e) {
    console.log('  [REG] Keyboard select hatası:', e.message);
  }

  // ===== YÖNTEM 5: Tüm select option'larını logla =====
  try {
    const allOpts = await page.evaluate(() => {
      const result = [];
      const selects = Array.from(document.querySelectorAll('select'));
      selects.forEach((s, si) => {
        const opts = Array.from(s.options).map(o => `${o.value}|${o.textContent.trim().substring(0, 40)}`);
        result.push(`select[${si}](${opts.length} opts): ${opts.slice(0, 15).join('; ')}`);
      });
      return result;
    });
    console.log('  [REG] ⚠ Tüm select options:', allOpts.join(' | '));
  } catch {}

  return false;
}

async function clickButtonByTerms(page, terms) {
  return await page.$$eval("button", (nodes, kws) => {
    const buttons = Array.from(nodes || []);
    const keys = (kws || []).map((k) => String(k).toLowerCase());
    for (const b of buttons) {
      if (!b || b.disabled) continue;
      const txt = (b.textContent || "").toLowerCase();
      if (b.type === "submit" || keys.some((k) => txt.includes(k))) {
        b.click();
        return true;
      }
    }
    return false;
  }, terms);
}

async function registerVfsAccount(account) {
  const { connect } = require("puppeteer-real-browser");
  let browser = null;
  let page = null;

  try {
    console.log(`[${new Date().toLocaleTimeString("tr-TR")}] 📝 VFS Kayıt: ${account.email}`);

    const { browser: br, page: pg } = await connect({
      headless: false,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--window-size=1366,768",
      ],
    });

    browser = br;
    page = pg;

    console.log("  [BROWSER] ✅ Real browser başlatıldı");
    console.log("  [REG 1/7] Kayıt sayfası...");

    await page.goto("https://visa.vfsglobal.com/tur/tr/fra/register", {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });

    console.log("  [REG 2/7] Cookie banner...");
    await dismissCookieModal(page);
    console.log("  [REG] ✅ Cookie banner kapatıldı");

    console.log("  [REG 3/7] Sayfa yüklenmesi bekleniyor...");
    // Daha uzun timeout ve daha fazla selector
    await page.waitForSelector('input[type="email"], input[name="email"], input[formcontrolname*="email"], input[id*="email"]', { timeout: 45000 });

    // Formun tamamen yüklenmesi için ekstra bekleme
    await delay(3000, 5000);

    console.log("  [REG 4/7] Form dolduruluyor...");

    const emailInput = await page.$('input[type="email"], input[name="email"], input[formcontrolname*="email"], input[id*="email"]');
    if (!emailInput) throw new Error("Email alanı bulunamadı");
    await emailInput.click({ clickCount: 3 });
    await emailInput.type(account.email, { delay: 45 });
    console.log(`  [REG] Email: ${account.email}`);

    await delay(500, 1000);

    const passInputs = await page.$$('input[type="password"]');
    if (passInputs.length < 2) throw new Error("Şifre alanları bulunamadı (bulundu: " + passInputs.length + ")");
    await passInputs[0].click({ clickCount: 3 });
    await passInputs[0].type(account.password, { delay: 45 });
    await delay(300, 600);
    await passInputs[1].click({ clickCount: 3 });
    await passInputs[1].type(account.password, { delay: 45 });
    console.log("  [REG] Şifre girildi");

    await delay(500, 1000);

    const phone = normalizePhone(account.phone);
    if (!phone || phone.length < 10) {
      throw new Error("Telefon boş/geçersiz (10 hane, başında 0 olmadan olmalı)");
    }

    const dialOk = await selectTurkeyDialCode(page);
    if (!dialOk) {
      // Screenshot al ve detaylı hata ver
      const ss = await takeScreenshotBase64(page);
      const pageHtml = await page.evaluate(() => document.body?.innerHTML?.substring(0, 2000) || '');
      console.log('  [REG] Page HTML (ilk 500):', pageHtml.substring(0, 500));
      throw new Error("Dial code Turkey(90) seçilemedi - detaylar loglarda");
    }

    await delay(500, 1000);

    const phoneSelector = [
      'input[placeholder*="without prefix"]',
      'input[placeholder*="Mobile Number"]',
      'input[placeholder*="Ön ek olmadan"]',
      'input[placeholder*="cep telefonu"]',
      'input[formcontrolname*="mobile"]',
      'input[formcontrolname*="phone"]',
      'input[name*="mobile"]',
      'input[name*="phone"]',
      'input[type="tel"]',
    ].join(", ");

    const phoneInput = await page.$(phoneSelector);
    if (!phoneInput) throw new Error("Telefon input alanı bulunamadı");
    await phoneInput.click({ clickCount: 3 });
    await phoneInput.type(phone, { delay: 45 });

    const filledPhone = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? String(el.value || "").replace(/\D/g, "") : "";
    }, phoneSelector);
    if (!filledPhone || filledPhone.length < 9) throw new Error("Telefon alanı doldurulamadı");

    console.log("  [REG 5/7] Onay kutuları...");
    try {
      await page.$$eval('input[type="checkbox"]', (boxes) => {
        for (const cb of Array.from(boxes || [])) if (!cb.checked) cb.click();
      });
    } catch {}

    // Checkbox'ların label'larına da tıkla (bazı Angular formlarında input gizli olabilir)
    try {
      await page.evaluate(() => {
        const labels = Array.from(document.querySelectorAll('label, .mat-checkbox, .custom-checkbox'));
        for (const l of labels) {
          const cb = l.querySelector('input[type="checkbox"]');
          if (cb && !cb.checked) {
            l.click();
          }
        }
        // mat-checkbox için
        const matCbs = Array.from(document.querySelectorAll('mat-checkbox:not(.mat-checkbox-checked), .mat-checkbox:not(.mat-checkbox-checked)'));
        for (const mc of matCbs) {
          mc.click();
        }
      });
    } catch {}

    console.log("  [REG] CAPTCHA bekleniyor...");
    await delay(5000, 9000);

    console.log("  [REG 6/7] Kayıt gönderiliyor...");
    const clickedSubmit = await clickButtonByTerms(page, ["continue", "devam", "register", "create", "kayıt", "devam et"]);
    if (!clickedSubmit) throw new Error("Submit butonu bulunamadı");

    await delay(4000, 7000);

    console.log("  [REG 7/7] OTP doğrulama...");
    const otpDetected = await page.evaluate(() => {
      const text = (document.body?.innerText || "").toLowerCase();
      const hasText = /otp|verification code|doğrulama kodu|one time|sms code|email code/.test(text);
      const hasInput = !!document.querySelector(
        'input[autocomplete="one-time-code"], input[name*="otp" i], input[id*="otp" i], input[maxlength="1"], input[maxlength="6"]'
      );
      return hasText || hasInput;
    });

    if (!otpDetected) {
      await postRegError(account, page, "OTP ekranı bulunamadı (form eksik ya da devam et pasif kaldı)");
      await completeRegistration(account.id, false);
      return;
    }

    const otpType = await page.evaluate(() => {
      const t = (document.body?.innerText || "").toLowerCase();
      return (t.includes("sms") || t.includes("mobile")) ? "sms" : "email";
    });

    const otp = await waitForRegistrationOtp(account.id, otpType, 180000);
    if (!otp) {
      await postRegError(account, page, `${otpType} OTP timeout`);
      await completeRegistration(account.id, false);
      return;
    }

    const segmented = await page.$$('input[maxlength="1"], input.otp-input');
    if (segmented.length > 1) {
      for (let i = 0; i < Math.min(segmented.length, otp.length); i++) {
        await segmented[i].type(otp[i], { delay: 30 });
      }
    } else {
      const otpInput = await page.$(
        'input[autocomplete="one-time-code"], input[name*="otp" i], input[id*="otp" i], input[maxlength="6"], input[type="tel"]'
      );
      if (!otpInput) throw new Error("OTP input alanı bulunamadı");
      await otpInput.click({ clickCount: 3 });
      await otpInput.type(otp, { delay: 45 });
    }

    await delay(700, 1200);
    await clickButtonByTerms(page, ["verify", "doğrula", "submit", "onayla"]);
    await delay(4000, 7000);

    const finalState = await page.evaluate(() => {
      const txt = (document.body?.innerText || "").toLowerCase();
      const url = window.location.href.toLowerCase();
      return { txt, url };
    });

    const success =
      finalState.url.includes("/login") ||
      finalState.txt.includes("already registered") ||
      finalState.txt.includes("success") ||
      finalState.txt.includes("başarı");

    if (!success) {
      await postRegError(account, page, "OTP sonrası başarı sinyali bulunamadı");
    }

    await completeRegistration(account.id, success);
  } catch (err) {
    console.error(`  [REG] Genel hata: ${err.message}`);
    await postRegError(account, page, err.message);
    await completeRegistration(account.id, false);
  } finally {
    if (browser) {
      try { await browser.close(); } catch {}
    }
  }
}

module.exports = { fetchPendingRegistrations, registerVfsAccount };
