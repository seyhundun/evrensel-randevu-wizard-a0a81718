/**
 * Quiz/Anket Çözücü Bot v1.0
 * Puppeteer ile anket sayfasını açıp AI cevaplarıyla otomatik dolduran bot
 * Kullanım: node quiz.js
 */

require("dotenv").config();

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ocrpzwrsyiprfuzsyivf.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jcnB6d3JzeWlwcmZ1enN5aXZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMDQ1NzksImV4cCI6MjA4ODg4MDU3OX0.5MzKGm6byd1zLxjgxaXyQq5VfPFo_CE2MhcXijIRarc";

// VNC Display (VFS ile aynı mantık)
const DISPLAY = process.env.QUIZ_DISPLAY || ":99";

let isRunning = false;
let currentBrowser = null;

// ==================== SUPABASE HELPERS ====================

async function supabaseGet(table, query = "") {
  const fetch = (await import("node-fetch")).default;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
  });
  return res.json();
}

async function supabaseUpdate(table, id, data) {
  const fetch = (await import("node-fetch")).default;
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_KEY,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(data),
  });
}

async function supabaseInsertLog(message, status = "info") {
  const fetch = (await import("node-fetch")).default;
  await fetch(`${SUPABASE_URL}/rest/v1/idata_tracking_logs`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ message: `[QUIZ] ${message}`, status }),
  });
}

// ==================== AI ANALİZ ====================

async function analyzeWithAI(url) {
  const fetch = (await import("node-fetch")).default;
  console.log(`🧠 AI analiz başlıyor: ${url}`);
  await supabaseInsertLog(`AI analiz başlıyor: ${url}`, "info");

  const res = await fetch(`${SUPABASE_URL}/functions/v1/analyze-link`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, mode: "bot" }),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || `AI analiz hatası: ${res.status}`);
  }

  // Parse JSON from AI answer
  let questions;
  try {
    const answerText = data.answer;
    // Extract JSON from possible markdown code blocks
    const jsonMatch = answerText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, answerText];
    const jsonStr = jsonMatch[1].trim();
    const parsed = JSON.parse(jsonStr);
    questions = parsed.questions || [];
  } catch (e) {
    console.error("❌ AI cevabı JSON parse edilemedi:", e.message);
    console.log("Ham cevap:", data.answer);
    await supabaseInsertLog(`AI cevabı parse edilemedi: ${e.message}`, "error");
    return { questions: [], rawAnswer: data.answer };
  }

  console.log(`✅ ${questions.length} soru tespit edildi`);
  await supabaseInsertLog(`${questions.length} soru tespit edildi`, "success");
  return { questions, rawAnswer: data.answer };
}

// ==================== TARAYICI KONTROL ====================

async function launchBrowser(proxyEnabled = false) {
  const { connect } = require("puppeteer-real-browser");

  const options = {
    headless: false,
    turnstile: false,
    disableXvfb: true,
    customConfig: {
      chromePath: undefined,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--start-maximized",
      ],
    },
    connectOption: {},
  };

  // Set display
  process.env.DISPLAY = DISPLAY;

  console.log(`🖥️ Chrome başlatılıyor (Display: ${DISPLAY})...`);
  const { browser, page } = await connect(options);
  currentBrowser = browser;

  // Stealth settings
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  return { browser, page };
}

// ==================== İNSAN BENZERİ ETKİLEŞİM ====================

function randomDelay(min = 100, max = 400) {
  return new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));
}

async function humanType(page, selector, text) {
  await page.click(selector, { clickCount: 3 }); // Select all
  await randomDelay(100, 200);
  for (const char of text) {
    await page.type(selector, char, { delay: 30 + Math.random() * 80 });
  }
  await randomDelay(200, 400);
}

async function humanClick(page, element) {
  const box = await element.boundingBox();
  if (!box) return false;
  
  const x = box.x + box.width / 2 + (Math.random() - 0.5) * 4;
  const y = box.y + box.height / 2 + (Math.random() - 0.5) * 4;
  
  await page.mouse.move(x, y, { steps: 5 + Math.floor(Math.random() * 10) });
  await randomDelay(50, 150);
  await page.mouse.down();
  await randomDelay(30, 80);
  await page.mouse.up();
  return true;
}

// ==================== SORU DOLDURMA ====================

async function fillAnswers(page, questions) {
  console.log(`📝 ${questions.length} soruyu doldurmaya başlıyor...`);
  await supabaseInsertLog(`${questions.length} soruyu doldurmaya başlıyor`, "info");

  let filled = 0;
  let failed = 0;

  for (const q of questions) {
    try {
      console.log(`\n--- Soru ${q.question_number}: ${q.question_text?.slice(0, 60)}...`);
      console.log(`   Tip: ${q.type}, Cevap: ${q.answer}`);

      if (q.type === "multiple_choice") {
        const success = await fillMultipleChoice(page, q);
        if (success) filled++;
        else failed++;
      } else if (q.type === "text_input") {
        const success = await fillTextInput(page, q);
        if (success) filled++;
        else failed++;
      } else {
        console.log(`   ⚠️ Bilinmeyen soru tipi: ${q.type}`);
        failed++;
      }

      await randomDelay(500, 1500);
    } catch (err) {
      console.error(`   ❌ Soru ${q.question_number} hatası:`, err.message);
      failed++;
    }
  }

  const msg = `Doldurma tamamlandı: ${filled} başarılı, ${failed} başarısız`;
  console.log(`\n✅ ${msg}`);
  await supabaseInsertLog(msg, failed > 0 ? "warning" : "success");
  return { filled, failed };
}

async function fillMultipleChoice(page, q) {
  // Strategy 1: CSS selector hint from AI
  if (q.selector_hint) {
    try {
      const el = await page.$(q.selector_hint);
      if (el) {
        await humanClick(page, el);
        console.log(`   ✅ Selector ile seçildi: ${q.selector_hint}`);
        return true;
      }
    } catch (e) { /* devam */ }
  }

  // Strategy 2: Find by answer text matching radio/checkbox labels
  const answerText = q.answer.toLowerCase().trim();
  
  const found = await page.evaluate((answer, qText) => {
    // Find all radio buttons and checkboxes
    const inputs = document.querySelectorAll('input[type="radio"], input[type="checkbox"]');
    
    for (const input of inputs) {
      // Check associated label
      const label = input.labels?.[0] || 
                    input.closest('label') ||
                    input.parentElement?.querySelector('label, span, div');
      
      if (label) {
        const labelText = label.textContent?.toLowerCase().trim() || "";
        if (labelText.includes(answer) || answer.includes(labelText)) {
          input.scrollIntoView({ behavior: "smooth", block: "center" });
          return { found: true, id: input.id, name: input.name, value: input.value };
        }
      }
    }

    // Fallback: search all clickable elements near question text
    const allElements = document.querySelectorAll('li, div, span, p, a, button');
    for (const el of allElements) {
      const text = el.textContent?.toLowerCase().trim() || "";
      if (text === answer || (text.length < 200 && text.includes(answer))) {
        const clickable = el.querySelector('input') || el;
        clickable.scrollIntoView({ behavior: "smooth", block: "center" });
        return { found: true, tagFallback: true };
      }
    }

    return { found: false };
  }, answerText, q.question_text?.toLowerCase() || "");

  if (found.found) {
    if (found.id) {
      await page.click(`#${found.id}`);
    } else if (found.name && found.value) {
      await page.click(`input[name="${found.name}"][value="${found.value}"]`);
    } else {
      // Click by text content match
      const elements = await page.$$('li, div, span, label, a');
      for (const el of elements) {
        const text = await page.evaluate(e => e.textContent?.toLowerCase().trim(), el);
        if (text && (text === answerText || text.includes(answerText))) {
          const input = await el.$('input');
          await humanClick(page, input || el);
          break;
        }
      }
    }
    console.log(`   ✅ Çoktan seçmeli cevap seçildi`);
    return true;
  }

  // Strategy 3: answer_index based selection
  if (q.answer_index !== undefined && q.answer_index !== null) {
    const radios = await page.$$('input[type="radio"], input[type="checkbox"]');
    if (radios.length > q.answer_index) {
      await humanClick(page, radios[q.answer_index]);
      console.log(`   ✅ Index ile seçildi: ${q.answer_index}`);
      return true;
    }
  }

  console.log(`   ⚠️ Çoktan seçmeli cevap bulunamadı`);
  return false;
}

async function fillTextInput(page, q) {
  // Strategy 1: CSS selector hint
  if (q.selector_hint) {
    try {
      const el = await page.$(q.selector_hint);
      if (el) {
        await humanType(page, q.selector_hint, q.answer);
        console.log(`   ✅ Selector ile dolduruldu`);
        return true;
      }
    } catch (e) { /* devam */ }
  }

  // Strategy 2: Find textarea/input near question text
  const filled = await page.evaluate((qText, answer) => {
    const inputs = document.querySelectorAll('input[type="text"], textarea, input:not([type])');
    
    for (const input of inputs) {
      // Check if this input is near the question text
      const parent = input.closest('div, fieldset, section, form');
      if (parent) {
        const parentText = parent.textContent?.toLowerCase() || "";
        if (parentText.includes(qText.toLowerCase().slice(0, 30))) {
          input.scrollIntoView({ behavior: "smooth", block: "center" });
          input.focus();
          input.value = answer;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        }
      }
    }
    return false;
  }, q.question_text || "", q.answer);

  if (filled) {
    console.log(`   ✅ Metin girişi dolduruldu`);
    return true;
  }

  console.log(`   ⚠️ Metin alanı bulunamadı`);
  return false;
}

// ==================== ANA DÖNGÜ ====================

async function processQuiz(url) {
  isRunning = true;
  let browser, page;

  try {
    // 1) AI Analiz
    const { questions, rawAnswer } = await analyzeWithAI(url);
    
    if (questions.length === 0) {
      console.log("⚠️ Soru bulunamadı. Ham AI cevabı:");
      console.log(rawAnswer);
      await supabaseInsertLog("Soru bulunamadı - ham cevap döndürüldü", "warning");
      return;
    }

    // 2) Chrome'u aç
    const result = await launchBrowser();
    browser = result.browser;
    page = result.page;

    // 3) Sayfaya git
    console.log(`🌐 Sayfaya gidiliyor: ${url}`);
    await supabaseInsertLog(`Sayfaya gidiliyor: ${url}`, "info");
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    await randomDelay(2000, 4000);

    // 4) Soruları doldur
    const result2 = await fillAnswers(page, questions);

    // 5) Sonuç
    await supabaseInsertLog(
      `Quiz tamamlandı - ${result2.filled}/${questions.length} soru dolduruldu`,
      result2.failed > 0 ? "warning" : "success"
    );

    // Bot bitmeyecek - kullanıcı VNC'den göndere basabilir
    console.log("\n🖥️ Tarayıcı açık kalıyor - VNC'den kontrol edebilirsiniz.");
    console.log("   Gönder butonuna manuel basabilirsiniz.");
    console.log("   Kapatmak için Ctrl+C");

    // Tarayıcı kapanana kadar bekle
    await new Promise((resolve) => {
      browser.on("disconnected", resolve);
    });
  } catch (err) {
    console.error("❌ Quiz hatası:", err.message);
    await supabaseInsertLog(`Hata: ${err.message}`, "error");
  } finally {
    isRunning = false;
    if (browser) {
      try { await browser.close(); } catch (e) {}
    }
  }
}

// ==================== DB POLLİNG (Dashboard'dan komut al) ====================

async function pollForQuizTasks() {
  console.log("🔄 Quiz bot başlatıldı - görev bekleniyor...");
  await supabaseInsertLog("Quiz bot başlatıldı - görev bekleniyor", "info");

  while (true) {
    try {
      // link_analyses tablosunda status=pending olan kayıtları kontrol et
      const tasks = await supabaseGet(
        "link_analyses",
        "status=eq.quiz_pending&order=created_at.asc&limit=1"
      );

      if (tasks.length > 0) {
        const task = tasks[0];
        console.log(`\n📋 Yeni quiz görevi: ${task.url}`);
        
        // Durumu güncelle
        await supabaseUpdate("link_analyses", task.id, { status: "quiz_running" });
        
        // Quiz'i çöz
        await processQuiz(task.url);
        
        // Tamamlandı
        await supabaseUpdate("link_analyses", task.id, { status: "quiz_done" });
      }
    } catch (err) {
      console.error("Polling hatası:", err.message);
    }

    // 5 saniye bekle
    await new Promise((r) => setTimeout(r, 5000));
  }
}

// ==================== CLI MODU ====================

const args = process.argv.slice(2);
if (args.length > 0) {
  // Direkt URL ile çalıştır: node quiz.js https://example.com/quiz
  processQuiz(args[0]).then(() => process.exit(0));
} else {
  // Polling modu: dashboard'dan görev bekle
  pollForQuizTasks();
}
