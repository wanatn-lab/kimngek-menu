const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const SEO_ASSIST_MODEL = "@cf/aisingapore/gemma-sea-lion-v4-27b-it";
const SEO_ASSIST_ALLOWED_ORIGIN = "https://kimngek-khaomoodang.wanat-n.workers.dev";

function corsHeaders(origin) {
  const allowOrigin = origin === SEO_ASSIST_ALLOWED_ORIGIN ? origin : SEO_ASSIST_ALLOWED_ORIGIN;
  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "vary": "origin"
  };
}

function extractJsonObject(text) {
  // Models sometimes wrap JSON in prose or code fences - pull out the first {...} block.
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("no JSON object found in model output");
  }
  return JSON.parse(text.slice(start, end + 1));
}

async function handleSeoAssist(request, env) {
  const origin = request.headers.get("origin") || "";
  const headers = { ...corsHeaders(origin), "content-type": "application/json; charset=utf-8" };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }
  if (!env.AI) {
    return new Response(JSON.stringify({ error: "AI binding ยังไม่ได้ตั้งค่าบน Worker นี้" }), { status: 500, headers });
  }

  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "อ่านข้อมูลที่ส่งมาไม่ได้ (ต้องเป็น JSON)" }), { status: 400, headers });
  }

  const title = (payload && payload.title ? String(payload.title) : "").slice(0, 500);
  const body = (payload && payload.body ? String(payload.body) : "").slice(0, 12000);
  if (!body.trim()) {
    return new Response(JSON.stringify({ error: "ไม่มีเนื้อหาบทความให้ประมวลผล" }), { status: 400, headers });
  }

  const systemPrompt =
    "คุณเป็นผู้เชี่ยวชาญด้าน SEO และ GEO (Generative Engine Optimization) ให้กับเว็บไซต์ร้านอาหารไทยขนาดเล็ก " +
    "ตอบเป็นภาษาไทยเท่านั้น และตอบกลับเป็น JSON ที่ถูกต้อง (valid JSON) เพียงอย่างเดียว ห้ามมีข้อความอื่นนอก JSON " +
    "ห้ามใส่ code fence หรือคำอธิบายใดๆ นอกวงเล็บปีกกา";

  const userPrompt =
    "หัวข้อบทความ: " + (title || "(ไม่มีหัวข้อ)") + "\n\n" +
    "เนื้อหาบทความที่วางเข้ามา (อาจมีการจัดรูปแบบไม่เรียบร้อยจากการ copy-paste):\n---\n" + body + "\n---\n\n" +
    "กรุณาส่งกลับ JSON ที่มีคีย์ต่อไปนี้เท่านั้น:\n" +
    '{\n' +
    '  "meta_description": "คำอธิบายสั้น 150-160 ตัวอักษร ดึงดูดให้คนคลิก เหมาะกับ SEO",\n' +
    '  "cleaned_body": "เนื้อหาบทความเดิม จัดรูปแบบใหม่เป็น Markdown ที่สะอาด มีหัวข้อย่อย (##, ###) และย่อหน้าที่เหมาะสม ไม่เพิ่มเนื้อหาใหม่ ไม่ตัดเนื้อหาสำคัญออก",\n' +
    '  "qna_markdown": "หัวข้อ \\"### คำถามที่พบบ่อย\\" ตามด้วยคำถาม-คำตอบ 3 ข้อที่เกี่ยวข้องกับบทความ รูปแบบ **Q: ...** ขึ้นบรรทัดใหม่ตามด้วย A: ... เว้นบรรทัดว่างคั่นแต่ละคู่ (ช่วยให้ AI อื่นๆ ดึงคำตอบไปใช้ได้ง่าย)"\n' +
    '}';

  let aiResult;
  try {
    aiResult = await env.AI.run(SEO_ASSIST_MODEL, {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "เรียกใช้ AI ไม่สำเร็จ: " + (e && e.message ? e.message : "unknown") }), { status: 502, headers });
  }

  const rawText = aiResult && aiResult.response ? aiResult.response : "";
  let parsed;
  try {
    parsed = extractJsonObject(rawText);
  } catch (e) {
    let debugShape;
    try { debugShape = JSON.stringify(aiResult).slice(0, 4000); } catch (e2) { debugShape = String(aiResult); }
    return new Response(JSON.stringify({ error: "AI ตอบกลับมาในรูปแบบที่อ่านไม่ได้ ลองใหม่อีกครั้ง", debugRaw: rawText.slice(0, 4000), debugShape: debugShape }), { status: 502, headers });
  }

  return new Response(
    JSON.stringify({
      metaDescription: typeof parsed.meta_description === "string" ? parsed.meta_description : "",
      cleanedBody: typeof parsed.cleaned_body === "string" ? parsed.cleaned_body : "",
      qnaMarkdown: typeof parsed.qna_markdown === "string" ? parsed.qna_markdown : ""
    }),
    { status: 200, headers }
  );
}

function html(body, status = 200) {
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><title>Decap CMS</title><body>${body}</body></html>`, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
  });
}

function callbackResponse(status, payload) {
  const message = `authorization:github:${status}:${JSON.stringify(payload).replace(/</g, "\\u003c")}`;
  return html(`<script>
    window.opener && window.opener.postMessage("authorizing:github", "*");
    window.opener && window.opener.postMessage(${JSON.stringify(message)}, "*");
    window.close();
  </script><p>กำลังยืนยันการเข้าสู่ระบบ… คุณสามารถปิดหน้าต่างนี้ได้</p>`);
}

function randomState() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/seo-assist") {
      return handleSeoAssist(request, env);
    }

    const isOAuthCallback = url.pathname === "/callback" || (
      url.pathname === "/" && (url.searchParams.has("code") || url.searchParams.has("error"))
    );

    // Accept the configured callback path and a root-path fallback. The fallback
    // protects the sign-in flow if the OAuth app still has the Worker origin as
    // its callback URL while its settings are being updated.
    if (isOAuthCallback) {
      if (url.searchParams.get("provider") && url.searchParams.get("provider") !== "github") {
        return html("Invalid OAuth provider.", 400);
      }
      const storedState = request.headers.get("cookie")?.match(/(?:^|;\\s*)decap_oauth_state=([^;]+)/)?.[1];
      const state = url.searchParams.get("state");
      const code = url.searchParams.get("code");
      if (!code || !state || !storedState || state !== storedState) {
        return callbackResponse("error", { error: "OAuth validation failed. Please try again." });
      }

      const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          client_id: env.GITHUB_OAUTH_ID,
          client_secret: env.GITHUB_OAUTH_SECRET,
          code,
          redirect_uri: `${url.origin}/callback`
        })
      });
      const tokenData = await tokenResponse.json();
      if (!tokenResponse.ok || !tokenData.access_token) {
        return callbackResponse("error", { error: tokenData.error_description || "GitHub token exchange failed." });
      }
      return callbackResponse("success", { token: tokenData.access_token });
    }

    if (url.pathname === "/") {
      return html('<p>นี่คือบริการยืนยันตัวตนสำหรับ CMS</p><p>กลับไปที่ <a href="https://kimngek-khaomoodang.wanat-n.workers.dev/admin/">หน้า CMS</a> เพื่อแก้ไขเว็บไซต์</p>');
    }

    if (url.pathname === "/health") {
      return Response.json({
        service: "kimngek-cms-auth",
        githubOAuthClientConfigured: Boolean(env.GITHUB_OAUTH_ID),
        githubOAuthSecretConfigured: Boolean(env.GITHUB_OAUTH_SECRET)
      }, { headers: { "cache-control": "no-store" } });
    }

    if (url.pathname === "/auth") {
      if (url.searchParams.get("provider") !== "github") {
        return html("Invalid OAuth provider.", 400);
      }

      const state = randomState();
      const isPrivate = env.GITHUB_REPO_PRIVATE && env.GITHUB_REPO_PRIVATE !== "0";
      const authorizeUrl = new URL(GITHUB_AUTHORIZE_URL);
      authorizeUrl.search = new URLSearchParams({
        client_id: env.GITHUB_OAUTH_ID,
        redirect_uri: `${url.origin}/callback`,
        scope: isPrivate ? "repo,user" : "public_repo,user",
        state
      }).toString();

      return new Response(null, {
        status: 302,
        headers: {
          location: authorizeUrl.toString(),
          "set-cookie": `decap_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
          "cache-control": "no-store"
        }
      });
    }

    return html("Not found.", 404);
  }
};
