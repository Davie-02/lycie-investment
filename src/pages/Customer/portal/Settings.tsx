/**
 * Profile & security: name, email (a change is confirmed by email and the old
 * address is told), phone for WhatsApp updates, password, and signing out of
 * other devices.
 */
import { useState, type ChangeEvent, type FormEvent } from "react";
import FormField from "@/components/forms/FormField";
import EmailField from "@/components/forms/EmailField";
import NewPasswordField from "@/components/forms/NewPasswordField";
import FormStatusBanner from "@/components/forms/FormStatusBanner";
import SignOutEverywhere from "@/components/customer/SignOutEverywhere";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { changeCustomerPassword, updateCustomerProfile } from "@/services/customer.service";
import { ApiError } from "@/services/http";
import { emailError } from "@/utils/email";
import { checkPassword } from "@/utils/password";
import { offerToSavePassword } from "@/utils/credentials";
import PortalHeading from "./PortalHeading";

interface ProfileValues {
  name: string;
  email: string;
  phone: string;
}

interface PasswordValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function Settings() {
  const { currentUser, updateCurrentUser } = useCustomerAuth();
  const [profile, setProfile] = useState<ProfileValues>({ name: currentUser?.name ?? "", email: currentUser?.email ?? "", phone: currentUser?.phone ?? "" });
  const [profileErrors, setProfileErrors] = useState<Partial<Record<keyof ProfileValues, string>>>({});
  const [profileStatus, setProfileStatus] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [password, setPassword] = useState<PasswordValues>({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [passwordErrors, setPasswordErrors] = useState<Partial<Record<keyof PasswordValues, string>>>({});
  const [passwordStatus, setPasswordStatus] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  const onProfile = (field: keyof ProfileValues) => (e: ChangeEvent<HTMLInputElement>) => setProfile((prev) => ({ ...prev, [field]: e.target.value }));
  const onPassword = (field: keyof PasswordValues) => (e: ChangeEvent<HTMLInputElement>) => setPassword((prev) => ({ ...prev, [field]: e.target.value }));

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    const errors: Partial<Record<keyof ProfileValues, string>> = {};
    if (!profile.name.trim()) errors.name = "Full name is required.";
    const emailProblem = emailError(profile.email);
    if (emailProblem) errors.email = emailProblem;
    setProfileErrors(errors);
    if (Object.keys(errors).length) return;
    setSavingProfile(true);
    setProfileStatus(null);
    try {
      const emailChanged = profile.email.trim().toLowerCase() !== (currentUser?.email ?? "").toLowerCase();
      updateCurrentUser(await updateCustomerProfile(profile));
      setProfileStatus({ tone: "success", text: emailChanged ? "Saved. Check your new inbox for a link to confirm the address." : "Your details were saved." });
    } catch (error) {
      setProfileStatus({ tone: "error", text: error instanceof ApiError ? error.message : "Unable to update your profile." });
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault();
    const errors: Partial<Record<keyof PasswordValues, string>> = {};
    if (!password.currentPassword) errors.currentPassword = "Enter your current password.";
    if (!password.newPassword) errors.newPassword = "Enter a new password.";
    else if (!checkPassword(password.newPassword, [currentUser?.name, currentUser?.email]).acceptable) errors.newPassword = "Your new password doesn't meet all the requirements below.";
    if (password.confirmPassword !== password.newPassword) errors.confirmPassword = "Passwords do not match.";
    setPasswordErrors(errors);
    if (Object.keys(errors).length) return;
    setSavingPassword(true);
    setPasswordStatus(null);
    try {
      await changeCustomerPassword(password.currentPassword, password.newPassword);
      // Lets the browser replace the saved password with the new one (see utils/credentials.ts).
      if (currentUser) void offerToSavePassword(currentUser.email, password.newPassword, currentUser.name);
      setPassword({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPasswordStatus({ tone: "success", text: "Password changed. Your other devices have been signed out." });
    } catch (error) {
      setPasswordStatus({ tone: "error", text: error instanceof ApiError ? error.message : "Unable to change your password." });
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <>
      <PortalHeading title="Profile & security" intro="Your details, your password, and the devices you're signed in on." />

      <form className="form-card customer-account__form" onSubmit={saveProfile} noValidate>
        <h3 style={{ marginTop: 0 }}>Your details</h3>
        {profileStatus && <FormStatusBanner status={profileStatus.tone} successMessage={profileStatus.text} errorMessage={profileStatus.text} />}
        <div className="form-grid form-grid--2col">
          <FormField id="profile-name" label="Full name" required value={profile.name} onChange={onProfile("name")} error={profileErrors.name} autoComplete="name" />
          <EmailField id="profile-email" name="email" value={profile.email} onChange={(email) => setProfile((prev) => ({ ...prev, email }))} error={profileErrors.email} autoComplete="username" />
          <FormField
            id="profile-phone"
            label="Phone (for WhatsApp updates)"
            type="tel"
            inputMode="tel"
            placeholder="0991 234 567"
            value={profile.phone}
            onChange={onProfile("phone")}
            autoComplete="tel"
          />
        </div>
        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={savingProfile}>
            {savingProfile ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>

      <form className="form-card customer-account__form" onSubmit={savePassword} noValidate name="change-password">
        <h3 style={{ marginTop: 0 }}>Change password</h3>
        {/* Tells the browser's password manager which saved login this belongs to. */}
        <input type="text" name="username" autoComplete="username" value={currentUser?.email ?? ""} readOnly tabIndex={-1} aria-hidden="true" className="visually-hidden" />
        {passwordStatus && <FormStatusBanner status={passwordStatus.tone} successMessage={passwordStatus.text} errorMessage={passwordStatus.text} />}
        <div className="form-grid form-grid--2col">
          <FormField
            id="current-password"
            name="current-password"
            label="Current password"
            type="password"
            required
            value={password.currentPassword}
            onChange={onPassword("currentPassword")}
            error={passwordErrors.currentPassword}
            autoComplete="current-password"
            wrapperClassName="form-grid__full"
          />
          <NewPasswordField
            id="new-password"
            label="New password"
            value={password.newPassword}
            onChange={(newPassword) => setPassword((prev) => ({ ...prev, newPassword }))}
            onSuggest={(newPassword) => setPassword((prev) => ({ ...prev, newPassword, confirmPassword: newPassword }))}
            personalData={[currentUser?.name, currentUser?.email]}
            error={passwordErrors.newPassword}
          />
          <FormField
            id="confirm-password"
            name="confirm-password"
            label="Confirm new password"
            type="password"
            required
            value={password.confirmPassword}
            onChange={onPassword("confirmPassword")}
            error={passwordErrors.confirmPassword}
            autoComplete="new-password"
          />
        </div>
        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={savingPassword}>
            {savingPassword ? "Saving…" : "Change password"}
          </button>
        </div>
      </form>

      <SignOutEverywhere />
    </>
  );
}
