// GitHub OAuth callback handler
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // projectId is passed as state
  const error = searchParams.get("error");

  // Handle OAuth errors
  if (error) {
    return NextResponse.redirect(
      new URL(`/projects?github_error=${error}`, req.url),
    );
  }

  // Validate code
  if (!code) {
    return NextResponse.redirect(
      new URL("/projects?github_error=no_code", req.url),
    );
  }

  try {
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
          redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/github/callback`,
        }),
      },
    );

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error("GitHub OAuth error:", tokenData);
      return NextResponse.redirect(
        new URL("/projects?github_error=token_exchange_failed", req.url),
      );
    }

    // Create response with redirect
    const redirectUrl = state
      ? `/projects?github_connected=true&project_id=${state}`
      : "/projects?github_connected=true";

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
    if (state) {
      response.cookies.set(`github_token_${state}`, tokenData.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      });
    }

    return response;
  } catch (error) {
    console.error("GitHub OAuth callback error:", error);
    return NextResponse.redirect(
      new URL("/projects?github_error=server_error", req.url),
    );
  }
}
