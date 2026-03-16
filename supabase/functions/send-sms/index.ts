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
    const { to, message } = await req.json();

    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");

    if (!accountSid || !authToken) {
      throw new Error("Twilio credentials not configured");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get "from" number
    const { data: fromSetting } = await supabase
      .from("bot_settings")
      .select("value")
      .eq("key", "twilio_from_number")
      .single();

    const fromNumber = fromSetting?.value;
    if (!fromNumber) {
      throw new Error("Twilio from number not configured in bot_settings");
    }

    // Build recipient list: use provided 'to' or fall back to bot_settings (comma-separated)
    let recipients: string[] = [];
    if (to) {
      recipients = to.split(",").map((n: string) => n.trim()).filter(Boolean);
    } else {
      const { data: toSetting } = await supabase
        .from("bot_settings")
        .select("value")
        .eq("key", "twilio_to_numbers")
        .single();
      if (toSetting?.value) {
        recipients = toSetting.value.split(",").map((n: string) => n.trim()).filter(Boolean);
      }
    }

    if (recipients.length === 0) {
      throw new Error("No recipient phone numbers configured");
    }

    // Send SMS to each recipient
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const credentials = btoa(`${accountSid}:${authToken}`);
    const smsBody = message || "Randevu bulundu! 🎉";

    const results = await Promise.allSettled(
      recipients.map(async (toNumber) => {
        const response = await fetch(twilioUrl, {
          method: "POST",
          headers: {
            "Authorization": `Basic ${credentials}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: toNumber,
            From: fromNumber,
            Body: smsBody,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(`Twilio error [${response.status}] for ${toNumber}: ${JSON.stringify(data)}`);
        }
        return { to: toNumber, sid: data.sid };
      })
    );

    const sent = results.filter(r => r.status === "fulfilled").map(r => (r as PromiseFulfilledResult<any>).value);
    const failed = results.filter(r => r.status === "rejected").map(r => (r as PromiseRejectedResult).reason?.message);

    return new Response(
      JSON.stringify({ ok: true, sent, failed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("SMS error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
