const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";

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
