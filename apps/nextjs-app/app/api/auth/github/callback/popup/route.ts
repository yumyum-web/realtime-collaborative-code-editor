// GitHub OAuth popup callback handler

export async function GET() {
  // This route is only used for popup OAuth flow
  // It will be redirected to after the main callback sets the cookie
  // It closes the popup and notifies the parent window
  return new Response(
    `<!DOCTYPE html>
    <html><head><title>GitHub Connected</title></head>
    <body style="background:#18181b;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
      <div style="text-align:center;">
        <h2>GitHub Connected!</h2>
        <p>You can close this window.</p>
      </div>
      <script>
        if (window.opener) {
          window.opener.postMessage({ type: 'GITHUB_CONNECTED' }, '*');
          window.close();
        }
      </script>
    </body></html>`,
    {
      headers: { "Content-Type": "text/html" },
      status: 200,
    },
  );
}
