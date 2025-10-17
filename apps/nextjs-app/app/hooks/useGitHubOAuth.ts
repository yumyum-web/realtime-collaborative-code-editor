/**
 * GitHub OAuth Integration Hook
 * Provides functions to connect with GitHub using OAuth flow (popup or redirect)
 */

export const useGitHubOAuth = () => {
  /**
   * Initiate GitHub OAuth flow
   * @param projectId - Optional project ID to associate the connection with
   * @param mode - 'popup' or 'redirect' (default: redirect)
   */
  const connectGitHub = (
    projectId?: string,
    mode: "popup" | "redirect" = "redirect",
    returnUrl?: string,
  ) => {
    const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;

    if (!clientId) {
      console.error("GitHub Client ID not configured");
      alert("GitHub integration is not configured. Please contact support.");
      return;
    }

    // Use the main callback for token, then redirect to popup callback for window handling
    const baseCallback = `${window.location.origin}/api/auth/github/callback`;
    // Encode state with projectId and return URL
    const stateData = {
      projectId: projectId || "",
      returnUrl: returnUrl || window.location.pathname,
    };
    const state = btoa(JSON.stringify(stateData));
    const scope = "repo read:user";

    const githubAuthUrl = new URL("https://github.com/login/oauth/authorize");
    githubAuthUrl.searchParams.append("client_id", clientId);
    githubAuthUrl.searchParams.append("redirect_uri", baseCallback);
    githubAuthUrl.searchParams.append("scope", scope);
    githubAuthUrl.searchParams.append("state", state);

    if (mode === "popup") {
      // Add popup flag to callback URL
      const callbackWithPopup = `${baseCallback}?popup=true`;
      githubAuthUrl.searchParams.set("redirect_uri", callbackWithPopup);

      // Open OAuth in popup window
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        githubAuthUrl.toString(),
        "GitHub OAuth",
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`,
      );

      if (!popup) {
        alert(
          "Popup blocked! Please allow popups for this site or use redirect mode.",
        );
        return;
      }

      // Listen for postMessage from popup callback
      const messageHandler = (event: MessageEvent) => {
        if (event.data && event.data.type === "GITHUB_CONNECTED") {
          window.removeEventListener("message", messageHandler);
          // Reload to check for new connection and update UI
          window.location.reload();
        }
      };
      window.addEventListener("message", messageHandler);
    } else {
      // Redirect mode
      window.location.href = githubAuthUrl.toString();
    }
  };

  /**
   * Disconnect GitHub (remove tokens)
   */
  const disconnectGitHub = async (projectId?: string) => {
    try {
      // Call API to clear httpOnly cookies
      await fetch("/api/auth/github/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });

      return true;
    } catch (error) {
      console.error("Failed to disconnect GitHub:", error);
      return false;
    }
  };

  return {
    connectGitHub,
    disconnectGitHub,
  };
};
