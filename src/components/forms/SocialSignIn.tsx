import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { getAuthProviders, type AuthProviders } from "@/services/authProviders.service";
import { loadScript } from "@/utils/loadScript";

// The small slice of each provider's browser library we use. Typed here (instead
// of `any`) so a wrong call is caught when building.
interface GoogleIdentity {
  accounts: {
    id: {
      initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
      renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
    };
  };
}
interface FacebookSdk {
  init: (config: { appId: string; cookie: boolean; xfbml: boolean; version: string }) => void;
  login: (callback: (response: { authResponse?: { accessToken: string } }) => void, options: { scope: string }) => void;
}
declare global {
  interface Window {
    google?: GoogleIdentity;
    FB?: FacebookSdk;
  }
}

interface SocialSignInProps {
  /** Current state of the page's "Keep me signed in" checkbox. */
  remember: boolean;
  /** Changes the wording ("Sign in with Google" vs "Sign up with Google"). */
  mode: "signin" | "signup";
}

/**
 * "Continue with Google / Facebook" buttons for the customer sign-in and
 * sign-up pages. Renders nothing at all unless the server says a provider is
 * configured (GOOGLE_CLIENT_ID, FACEBOOK_APP_ID/SECRET — see DEPLOYMENT.md).
 *
 * The provider proves who the person is; the API verifies that proof and then
 * signs in the matching account or creates one. See server/src/auth/social-identity.ts.
 */
export default function SocialSignIn({ remember, mode }: SocialSignInProps) {
  const { loginGoogle, loginFacebook } = useCustomerAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [providers, setProviders] = useState<AuthProviders | null>(null);
  const googleButton = useRef<HTMLDivElement>(null);

  // Google's button calls back long after it was drawn, so read the checkbox
  // through a ref to get its CURRENT value rather than the value at draw time.
  const rememberRef = useRef(remember);
  rememberRef.current = remember;

  useEffect(() => {
    let cancelled = false;
    getAuthProviders().then((result) => {
      if (!cancelled) setProviders(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /** After a successful provider sign-in, go where the person was heading (or their account). */
  function goToDestination() {
    navigate((location.state as { from?: string } | null)?.from ?? "/account", { replace: true });
  }

  // Draw Google's own button (it must render itself: Google requires its official button).
  useEffect(() => {
    const google = providers?.google;
    if (!google) return;
    let cancelled = false;

    loadScript("https://accounts.google.com/gsi/client")
      .then(() => {
        if (cancelled || !window.google || !googleButton.current) return;
        window.google.accounts.id.initialize({
          client_id: google.clientId,
          callback: async ({ credential }) => {
            if (await loginGoogle(credential, rememberRef.current)) goToDestination();
          },
        });
        window.google.accounts.id.renderButton(googleButton.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          shape: "rectangular",
          text: mode === "signup" ? "signup_with" : "continue_with",
          width: Math.min(googleButton.current.clientWidth || 320, 400),
        });
      })
      .catch(() => {
        // Script blocked (ad blocker, offline): the email form still works, so stay quiet.
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providers, mode]);

  // Load Facebook's SDK ahead of the click, because browsers only allow its
  // login popup when it opens directly from a click, with no waiting in between.
  useEffect(() => {
    const facebook = providers?.facebook;
    if (!facebook) return;
    loadScript("https://connect.facebook.net/en_US/sdk.js")
      .then(() => window.FB?.init({ appId: facebook.appId, cookie: false, xfbml: false, version: "v21.0" }))
      .catch(() => undefined);
  }, [providers]);

  function continueWithFacebook() {
    window.FB?.login(
      async (response) => {
        const token = response.authResponse?.accessToken;
        if (token && (await loginFacebook(token, rememberRef.current))) goToDestination();
      },
      { scope: "public_profile,email" }
    );
  }

  if (!providers || (!providers.google && !providers.facebook)) return null;

  return (
    <>
      <div className="auth-divider" role="separator">
        or
      </div>
      <div className="social-signin">
        {providers.google && <div className="social-signin__google" ref={googleButton} />}
        {providers.facebook && (
          <button type="button" className="btn btn-secondary social-signin__facebook" onClick={continueWithFacebook}>
            {mode === "signup" ? "Sign up with Facebook" : "Continue with Facebook"}
          </button>
        )}
      </div>
    </>
  );
}
