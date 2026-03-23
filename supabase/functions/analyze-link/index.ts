import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, analysisId, mode } = await req.json();
    if (!url) {
      return new Response(
        JSON.stringify({ error: "URL gerekli" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!firecrawlKey) throw new Error("FIRECRAWL_API_KEY yapılandırılmamış");
    if (!lovableKey) throw new Error("LOVABLE_API_KEY yapılandırılmamış");

    // 1) Scrape the page
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith("http")) formattedUrl = `https://${formattedUrl}`;

    console.log("Scraping:", formattedUrl);

    const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ["markdown", "html"],
        onlyMainContent: true,
      }),
    });

    const scrapeData = await scrapeRes.json();
    if (!scrapeRes.ok) {
      const errMsg = scrapeData?.error || `Scrape failed: ${scrapeRes.status}`;
      if (analysisId) {
        await supabase.from("link_analyses").update({ status: "error", ai_answer: errMsg }).eq("id", analysisId);
      }
      return new Response(
        JSON.stringify({ error: errMsg }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const markdown = scrapeData?.data?.markdown || scrapeData?.markdown || "";
    const html = scrapeData?.data?.html || scrapeData?.html || "";
    const pageTitle = scrapeData?.data?.metadata?.title || scrapeData?.metadata?.title || "";

    // Update with scraped content
    if (analysisId) {
      await supabase.from("link_analyses").update({
        page_title: pageTitle,
        page_content: markdown.slice(0, 10000),
        status: "analyzing",
      }).eq("id", analysisId);
    }

    // 2) AI Analysis - structured for bot mode
    const truncatedContent = markdown.slice(0, 8000);
    const truncatedHtml = html.slice(0, 4000);

    const isBot = mode === "bot";

    const systemPrompt = isBot
      ? `Sen bir anket/sınav çözme asistanısın. Verilen sayfa içeriğindeki soruları tespit et ve her birine cevap ver.

ZORUNLU: Cevabını sadece JSON formatında ver, başka hiçbir şey yazma.
JSON formatı:
{
  "questions": [
    {
      "question_number": 1,
      "question_text": "Sorunun metni",
      "type": "multiple_choice" veya "text_input",
      "options": ["A şıkkı", "B şıkkı", "C şıkkı", "D şıkkı"],
      "answer": "Doğru cevap metni (şık ise şıkkın tam metni)",
      "answer_index": 0,
      "selector_hint": "input[name='q1'] veya benzeri CSS seçici ipucu (HTML'den çıkarabilirsen)"
    }
  ]
}

HTML'den form elemanlarının name, id, class bilgilerini çıkar ve selector_hint olarak ver.
Eğer şık bulamazsan type: "text_input" yap ve answer'a cevap metnini yaz.`
      : `Sen bir web sayfa analiz asistanısın. Verilen sayfa içeriğini analiz et.
Eğer sayfada sorular varsa, bunları tespit et ve her birine doğru cevabı ver.
Eğer soru yoksa, sayfanın özetini çıkar.
Cevapları Türkçe ver. Markdown formatı kullan.`;

    const userContent = isBot
      ? `Sayfa: ${formattedUrl}\nBaşlık: ${pageTitle}\n\nMarkdown İçerik:\n${truncatedContent}\n\nHTML Yapısı:\n${truncatedHtml}`
      : `Sayfa: ${formattedUrl}\nBaşlık: ${pageTitle}\n\nİçerik:\n${truncatedContent}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI error:", aiRes.status, errText);
      
      if (aiRes.status === 429) {
        if (analysisId) await supabase.from("link_analyses").update({ status: "error", ai_answer: "Rate limit aşıldı, lütfen biraz bekleyin." }).eq("id", analysisId);
        return new Response(JSON.stringify({ error: "Rate limit aşıldı" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiRes.status === 402) {
        if (analysisId) await supabase.from("link_analyses").update({ status: "error", ai_answer: "AI kredisi yetersiz." }).eq("id", analysisId);
        return new Response(JSON.stringify({ error: "AI kredisi yetersiz" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      throw new Error(`AI gateway error: ${aiRes.status}`);
    }

    const aiData = await aiRes.json();
    const answer = aiData?.choices?.[0]?.message?.content || "Cevap üretilemedi";

    // 3) Save result
    if (analysisId) {
      await supabase.from("link_analyses").update({
        ai_answer: answer,
        status: "completed",
      }).eq("id", analysisId);
    }

    return new Response(
      JSON.stringify({ success: true, pageTitle, answer }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("analyze-link error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
