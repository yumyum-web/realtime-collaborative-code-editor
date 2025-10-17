// GitHub OAuth callback handler
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Parse state to get projectId and returnUrl
  let projectId = "";
  let returnUrl = "/projects";
  try {
    if (state) {
      const stateData = JSON.parse(atob(state));
      projectId = stateData.projectId || "";
      returnUrl = stateData.returnUrl || "/projects";
    }
  } catch {
    // Fallback for old state format (just projectId)
    projectId = state || "";
    returnUrl = "/projects";
  }

  // Handle OAuth errors
  if (error) {
    return NextResponse.redirect(
      new URL(`${returnUrl}?github_error=${error}`, req.url),
    );
  }

  // Validate code
  if (!code) {
    return NextResponse.redirect(
      new URL(`${returnUrl}?github_error=no_code`, req.url),
    );
  }

  try {
    // Validate environment variables
    if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
      console.error("Missing GitHub OAuth credentials in environment variables");
      return NextResponse.redirect(
        new URL(`${returnUrl}?github_error=missing_credentials`, req.url),
      );
    }

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/github/callback`;
    
    console.log("GitHub OAuth token exchange attempt:", {
      hasClientId: !!process.env.GITHUB_CLIENT_ID,
      hasClientSecret: !!process.env.GITHUB_CLIENT_SECRET,
      redirectUri,
      hasCode: !!code,
    });

    // Exchange code for access token
    const tokenResponse = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: redirectUri,
        }),
      },
    );

    if (!tokenResponse.ok) {
      console.error("GitHub token exchange failed with status:", tokenResponse.status);
      return NextResponse.redirect(
        new URL(`${returnUrl}?github_error=token_exchange_failed&status=${tokenResponse.status}`, req.url),
      );
    }

    const tokenData = await tokenResponse.json();

    console.log("GitHub token response:", {
      hasToken: !!tokenData.access_token,
      error: tokenData.error,
      errorDescription: tokenData.error_description,
    });

    if (tokenData.error || !tokenData.access_token) {
      console.error("GitHub OAuth error:", tokenData);
      return NextResponse.redirect(
        new URL(
          `${returnUrl}?github_error=token_exchange_failed&details=${encodeURIComponent(tokenData.error_description || tokenData.error || "no_token")}`,
          req.url
        ),
      );
    }

    // Check if this is a popup (by checking if opener exists via a query param)
    const isPopup = searchParams.get("popup") === "true";

    if (isPopup) {
      // For popup mode, return HTML that closes the popup and notifies parent
      const response = new Response(
        `<!DOCTYPE html>
        <html>
        <head>
          <title>GitHub Connected</title>
          <style>
            body {
              background: #18181b;
              color: #fff;
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
            }
            .container {
              text-align: center;
              padding: 2rem;
            }
            .success-icon {
              font-size: 4rem;
              margin-bottom: 1rem;
            }
            h2 {
              margin: 0 0 0.5rem 0;
            }
            p {
              color: #a1a1aa;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">✓</div>
            <h2>GitHub Connected!</h2>
            <p>Closing window...</p>
          </div>
          <script>
            // Notify parent window
            if (window.opener) {
              window.opener.postMessage({
                type: 'GITHUB_CONNECTED',
                projectId: '${projectId}',
                success: true
              }, '*');
              setTimeout(() => window.close(), 1000);
            } else {
              window.location.href = '${returnUrl}?github_connected=true';
            }
          </script>
        </body>
        </html>`,
        {
          headers: { "Content-Type": "text/html" },
          status: 200,
        },
      );

      // Set cookies before returning HTML response
      response.headers.append(
        "Set-Cookie",
        `github_token=${tokenData.access_token}; Path=/; HttpOnly; ${process.env.NODE_ENV === "production" ? "Secure;" : ""} SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`,
      );

      if (projectId) {
        response.headers.append(
          "Set-Cookie",
          `github_token_${projectId}=${tokenData.access_token}; Path=/; HttpOnly; ${process.env.NODE_ENV === "production" ? "Secure;" : ""} SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`,
        );
      }

      return response;
    } else {
      // For redirect mode (non-popup), redirect back to original page
      const redirectUrl = `${returnUrl}?github_connected=true${projectId ? `&project_id=${projectId}` : ""}`;

      const response = NextResponse.redirect(new URL(redirectUrl, req.url));

      // Store token in httpOnly cookie (more secure than localStorage)
      response.cookies.set("github_token", tokenData.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: "/",
      });

      // If we have a project ID in state, also set a project-specific cookie
      if (projectId) {
        response.cookies.set(
          `github_token_${projectId}`,
          tokenData.access_token,
          {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 30,
            path: "/",
          },
        );
      }

      return response;
    }
  } catch (error) {
    console.error("GitHub OAuth callback error:", error);
    return NextResponse.redirect(
      new URL(`${returnUrl}?github_error=server_error`, req.url),
    );
  }
}
