import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * Check GitHub authentication status
 * Returns whether user is authenticated and their token
 */
export async function GET() {
  try {
    const cookieStore = await cookies();

    // Check for GitHub token in cookies
    const token = cookieStore.get("github_token")?.value;

    if (token) {
      // Verify token is valid by making a simple API call
      try {
        const response = await fetch("https://api.github.com/user", {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3+json",
          },
        });

        if (response.ok) {
          const userData = await response.json();
          return NextResponse.json({
            authenticated: true,
            token: token,
            user: {
              login: userData.login,
              name: userData.name,
              avatar_url: userData.avatar_url,
            },
          });
        } else {
          // Token is invalid, clear it
          const response = NextResponse.json({
            authenticated: false,
            token: null,
          });

          response.cookies.delete("github_token");
          return response;
        }
      } catch (error) {
        console.error("Error validating GitHub token:", error);
        return NextResponse.json({
          authenticated: false,
          token: null,
        });
      }
    }

    return NextResponse.json({
      authenticated: false,
      token: null,
    });
  } catch (error) {
    console.error("Error checking GitHub auth:", error);
    return NextResponse.json(
      {
        authenticated: false,
        token: null,
        error: "Failed to check authentication",
      },
      { status: 500 },
    );
  }
}
