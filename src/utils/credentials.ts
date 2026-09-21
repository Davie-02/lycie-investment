/**
 * Asks the browser to offer to save a password after a successful sign-in.
 *
 * Browsers decide for themselves when to show their "Save password?" prompt.
 * They normally do it when a form with a username and password field is
 * submitted, and every sign-in / sign-up / reset form here is built that way
 * (proper `autocomplete` values and field names). But on a single-page site
 * like this one the page never reloads after submitting, which some browsers
 * treat as "nothing happened" and skip the prompt. Chromium browsers (Chrome,
 * Edge, Opera, Android Chrome) let us ask explicitly through the Credential
 * Management API, which is what this does. Other browsers ignore it and use
 * their normal behaviour, so calling it is always safe.
 */

interface PasswordCredentialConstructor {
  new (data: { id: string; password: string; name?: string }): Credential;
}

export async function offerToSavePassword(email: string, password: string, name?: string): Promise<void> {
  try {
    const PasswordCredential = (window as unknown as { PasswordCredential?: PasswordCredentialConstructor }).PasswordCredential;
    if (!PasswordCredential || !navigator.credentials?.store) return;
    await navigator.credentials.store(new PasswordCredential({ id: email, password, name }));
  } catch {
    // Not supported, blocked, or the person declined: nothing to do.
  }
}
