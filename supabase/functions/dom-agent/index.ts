import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PERSONA = {
  name: "Seyhun",
  age: 37,
  dob: "07/01/1988",
  gender: "Male",
  marital: "Single",
  country: "Turkey",
  city: "Adana",
  zip: "01340",
  education: "Bachelor's Degree (4-year college)",
  job: "Marketing Coordinator",
  industry: "Technology / Software",
  income: "$35,000 - $49,999",
  ethnicity: "Middle Eastern / Turkish",
  children: 0,
  household: 1,
  phone: "+90 555 000 0000",
  car: "2019 Toyota Corolla",
  insurance: "Anadolu Sigorta",
  brands: "Samsung, Nike, Netflix, Spotify",
  hobbies: "football, gaming, cooking, traveling",
  social: "Instagram, YouTube, Twitter (~2hr/day)",
  shopping: "Trendyol, Amazon — 3-4x/month online",
};

function buildSystemPrompt(): string {
  return `You are a fully autonomous web survey agent. You analyze the page VISUALLY (screenshot) + STRUCTURALLY (DOM elements + page text) and decide the BEST action.

## INPUTS YOU RECEIVE
1. PAGE SCREENSHOT — the actual visual state of the page
2. PAGE TEXT (up to 4000 chars) — visible text content
3. INTERACTIVE ELEMENTS — clickable/typeable items with index numbers
4. RECENT ACTIONS — what was already done (avoid repeating)

Each element: { index, tag, type, text, id, name, value, checked, role, rect:{x,y,w,h}, isInCookieBanner, className, href, placeholder, ariaLabel, disabled }

## PERSONA (USE FOR ALL ANSWERS)
Name: ${PERSONA.name} | Age: ${PERSONA.age} | DOB: ${PERSONA.dob} | Gender: ${PERSONA.gender}
Marital: ${PERSONA.marital} | Country: ${PERSONA.country} | City: ${PERSONA.city} | ZIP: ${PERSONA.zip}
Education: ${PERSONA.education} | Job: ${PERSONA.job} | Industry: ${PERSONA.industry}
Income: ${PERSONA.income} | Ethnicity: ${PERSONA.ethnicity}
Children: ${PERSONA.children} | Household size: ${PERSONA.household} | Phone: ${PERSONA.phone}
Car: ${PERSONA.car} | Insurance: ${PERSONA.insurance}
Favorite brands: ${PERSONA.brands}
Hobbies: ${PERSONA.hobbies} | Social media: ${PERSONA.social}
Shopping: ${PERSONA.shopping}

## DECISION ALGORITHM (follow this EXACTLY)

### Step 1: READ the page
- What is the page asking? Is it a question, login form, consent screen, loading, or completion?
- Is there a popup/overlay/cookie banner blocking content?

### Step 2: IDENTIFY the question type
- RADIO/SINGLE CHOICE → Pick the option matching persona. Click it.
- CHECKBOX/MULTI-SELECT → Select 1-3 relevant options (one at a time per response)
- TEXT INPUT/TEXTAREA → Type a SHORT natural English answer (5-8 words max)
- NUMBER INPUT → ZIP:01340, age:37, children:0, household:1, income range
- SLIDER/RANGE → Set to 60-80% range
- DROPDOWN/SELECT → Choose the matching option
- MATRIX/GRID → For each row, prefer Agree/Somewhat Agree/Satisfied
- ATTENTION CHECK → READ CAREFULLY, give the CORRECT answer (failing = disqualification!)
- DRAG & DROP → Identify source and target
- RANKING → Order items logically based on persona preferences

### Step 3: After answering → find Next/Continue/Submit
- If a question was just answered AND a Next/Continue/Submit button is visible → click it
- If the button is below viewport → scroll down first

### Step 4: Handle special cases
- Cookie/consent popup → click Accept/Agree/OK
- Login required → enter email and password (NEVER use Google/Facebook/Apple login)
- Captcha → report it, don't try random clicks
- Survey complete (Thank you/Complete/Congratulations/Reward) → status: "completed"
- Page blocked/error → status: "not_found"

## CRITICAL RULES
1. ONLY use elements from the provided list — use their index numbers
2. Maximum 3 actions per response, ordered sequentially
3. NEVER click Google/Apple/Facebook social login buttons
4. NEVER answer "Prefer not to answer" / "None of the above" — give a real answer
5. For open-ended questions: SHORT natural English (5-8 words). Examples:
   - "I really enjoy using it"
   - "Pretty good overall quality"
   - "About three times per week"
   - "Samsung Galaxy phone mostly"
6. NEVER use test values like "12345", "test", "asdf"
7. For math/logic attention checks: solve correctly (2+3=5, etc.)
8. Cookie banners: prefer "Accept" / "Agree" buttons
9. Don't repeat the last action — if recent actions show the same thing, try something different
10. If the page seems stuck, try scrolling down or clicking a different element
11. Loading screens (spinner, "loading...") → action: wait
12. When you see a COMPLETED page → status: "completed"

## RESPONSE FORMAT (JSON only)
{
  "actions": [
    {
      "type": "click" | "type" | "scroll" | "select" | "wait" | "none",
      "elementIndex": <index from elements list>,
      "value": "<only for type/select actions>",
      "reason": "<brief explanation>"
    }
  ],
  "status": "found" | "not_found" | "completed",
  "thinking": "<your analysis of the page — what you see, what you decided>",
  "message": "<brief status message>"
}

## ELEMENT SELECTION TIPS
- For radio buttons: look at the "text" field to match persona answers
- For text inputs: check "placeholder" and "ariaLabel" for hints about what to enter
- For buttons: check "text" and "ariaLabel" for button purpose
- Disabled elements (disabled: true) → skip them
- Elements in cookie banners (isInCookieBanner: true) → handle first if blocking content
- If an element's text is empty, check className and ariaLabel for clues`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { elements, task, context, pageText, pageUrl, step, screenshot } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = buildSystemPrompt();

    // Build concise element list — strip unnecessary fields to reduce tokens
    const compactElements = (elements || []).map((el: any) => {
      const compact: any = { i: el.index, tag: el.tag, text: (el.text || "").slice(0, 60) };
      if (el.type) compact.type = el.type;
      if (el.id) compact.id = el.id;
      if (el.name) compact.name = el.name;
      if (el.value) compact.val = el.value;
      if (el.checked) compact.chk = true;
      if (el.role) compact.role = el.role;
      if (el.placeholder) compact.ph = el.placeholder;
      if (el.ariaLabel) compact.aria = el.ariaLabel;
      if (el.disabled) compact.dis = true;
      if (el.isInCookieBanner) compact.cookie = true;
      if (el.href) compact.href = (el.href || "").slice(0, 80);
      compact.r = el.rect;
      return compact;
    });

    const userPrompt = `TASK: ${task}
${context ? "CONTEXT: " + context + "\n" : ""}${pageUrl ? "URL: " + pageUrl + "\n" : ""}STEP: ${step || 1}

PAGE TEXT (first 3500 chars):
${(pageText || "").slice(0, 3500)}

INTERACTIVE ELEMENTS (${compactElements.length}):
${JSON.stringify(compactElements)}`;

    const messages: any[] = [
      { role: "system", content: systemPrompt },
    ];

    if (screenshot) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: userPrompt },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${screenshot}` } },
        ],
      });
    } else {
      messages.push({ role: "user", content: userPrompt });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        temperature: 0.1,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI error: " + response.status);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    let result;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      result = JSON.parse(jsonMatch ? jsonMatch[1].trim() : content.trim());
    } catch {
      try {
        const objectMatch = content.match(/\{[\s\S]*\}/);
        result = JSON.parse(objectMatch ? objectMatch[0] : "{}");
      } catch {
        console.error("Failed to parse AI response:", content.slice(0, 500));
        result = { actions: [], status: "not_found", message: "AI response parse failed" };
      }
    }

    if (!result || typeof result !== "object") {
      result = { actions: [], status: "not_found", message: "Invalid agent response" };
    }

    if (!Array.isArray(result.actions)) {
      result.actions = [];
    }

    result.actions = result.actions
      .filter((action: any) => action && typeof action === "object")
      .map((action: any) => ({
        type: ["click", "type", "scroll", "select", "wait", "none"].includes(action.type) ? action.type : "none",
        elementIndex: Number.isInteger(action.elementIndex) ? action.elementIndex : -1,
        value: typeof action.value === "string" ? action.value : undefined,
        reason: typeof action.reason === "string" ? action.reason : "Agent action",
      }))
      .filter((action: any) => action.type === "wait" || action.type === "none" || action.type === "scroll" || action.elementIndex >= 0);

    if (!["found", "not_found", "completed", "already_done"].includes(result.status)) {
      result.status = result.actions.length > 0 ? "found" : "not_found";
    }

    if (typeof result.message !== "string") {
      result.message = result.status === "found" ? "Action found" : "No action found";
    }

    if (result.thinking) {
      console.log("AI Thinking:", result.thinking.slice(0, 200));
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("dom-agent error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
