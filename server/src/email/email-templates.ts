const BRAND_NAVY = "#19406C";
const BRAND_LIGHT = "#76CAE9";

/**
 * Everything a visitor can type (names, messages, vehicle names) must go
 * through this before being placed in an HTML email body. Without it, a
 * submission with markup in the name field would be delivered — from the
 * company's own domain — to whatever address the submitter entered, which
 * makes a convincing phishing vector.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function wrapper(bodyHtml: string): string {
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto;">
      <div style="background: ${BRAND_NAVY}; padding: 20px 24px;">
        <span style="color: #fff; font-size: 18px; font-weight: bold;">Lycie <span style="color: ${BRAND_LIGHT};">Investments</span></span>
      </div>
      <div style="padding: 24px; border: 1px solid #e3e2dd; border-top: none;">
        ${bodyHtml}
      </div>
    </div>
  `;
}

function formatMoney(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString("en-US")}`;
}

interface HireEmailDetails {
  fullName: string;
  vehicleName: string;
  pickupDate: Date;
  returnDate: Date;
  days: number;
  totalCost: number;
  currency: string;
}

function hireSummaryTable(details: HireEmailDetails): string {
  return `
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
      <tr><td style="padding: 6px 0; color: #667085;">Vehicle</td><td style="padding: 6px 0; text-align: right;">${escapeHtml(details.vehicleName)}</td></tr>
      <tr><td style="padding: 6px 0; color: #667085;">Pickup</td><td style="padding: 6px 0; text-align: right;">${details.pickupDate.toLocaleDateString()}</td></tr>
      <tr><td style="padding: 6px 0; color: #667085;">Return</td><td style="padding: 6px 0; text-align: right;">${details.returnDate.toLocaleDateString()}</td></tr>
      <tr><td style="padding: 6px 0; color: #667085;">Days</td><td style="padding: 6px 0; text-align: right;">${details.days}</td></tr>
      <tr><td style="padding: 6px 0; color: #667085; font-weight: bold;">Total</td><td style="padding: 6px 0; text-align: right; font-weight: bold;">${formatMoney(details.totalCost, details.currency)}</td></tr>
    </table>
  `;
}

export function hireRequestReceivedEmail(details: HireEmailDetails) {
  return {
    subject: "We've received your hire request",
    html: wrapper(`
      <p>Hi ${escapeHtml(details.fullName)},</p>
      <p>Thanks for your hire request — here's what you submitted. We'll confirm availability and get back to you shortly.</p>
      ${hireSummaryTable(details)}
      <p style="color: #667085; font-size: 13px;">This is an estimate pending confirmation, not a guaranteed booking yet.</p>
    `),
  };
}

export function hireBookingConfirmedEmail(details: HireEmailDetails) {
  return {
    subject: "Your hire booking is confirmed",
    html: wrapper(`
      <p>Hi ${escapeHtml(details.fullName)},</p>
      <p>Good news — your hire booking is confirmed.</p>
      ${hireSummaryTable(details)}
      <p>We look forward to seeing you at pickup.</p>
    `),
  };
}

export function hireBookingCancelledEmail(details: HireEmailDetails) {
  return {
    subject: "Your hire booking has been cancelled",
    html: wrapper(`
      <p>Hi ${escapeHtml(details.fullName)},</p>
      <p>Your hire booking for the following has been cancelled:</p>
      ${hireSummaryTable(details)}
      <p>If this wasn't expected, please get in touch and we'll help sort it out.</p>
    `),
  };
}

export function hireBookingCompletedEmail(details: HireEmailDetails) {
  return {
    subject: "Thanks for hiring with Lycie Investments",
    html: wrapper(`
      <p>Hi ${escapeHtml(details.fullName)},</p>
      <p>Thanks for hiring the ${escapeHtml(details.vehicleName)} with us — we hope it served you well. We'd love to help again next time you need a vehicle.</p>
    `),
  };
}

export function hireDueSoonReminderEmail(details: HireEmailDetails) {
  return {
    subject: `Reminder: your ${details.vehicleName} hire is due back soon`,
    html: wrapper(`
      <p>Hi ${escapeHtml(details.fullName)},</p>
      <p>Just a reminder that your hired ${escapeHtml(details.vehicleName)} is due back on <strong>${details.returnDate.toLocaleDateString()}</strong>.</p>
      <p>Please arrange the return, or contact us if you'd like to extend the hire.</p>
    `),
  };
}

export function hireOverdueReminderEmail(details: HireEmailDetails) {
  return {
    subject: `Overdue: your ${details.vehicleName} hire return`,
    html: wrapper(`
      <p>Hi ${escapeHtml(details.fullName)},</p>
      <p>Our records show the ${escapeHtml(details.vehicleName)} was due back on <strong>${details.returnDate.toLocaleDateString()}</strong> and hasn't been returned yet.</p>
      <p>Please contact us as soon as possible to arrange the return.</p>
    `),
  };
}

export function passwordResetEmail(resetUrl: string) {
  return {
    subject: "Reset your Lycie Investments password",
    html: wrapper(`
      <p>Someone requested a password reset for this account. If that was you, click below to choose a new password — this link expires in 1 hour and only works once.</p>
      <p style="margin: 24px 0;">
        <a href="${resetUrl}" style="background: ${BRAND_NAVY}; color: #fff; padding: 10px 20px; border-radius: 4px; text-decoration: none; display: inline-block;">Reset Password</a>
      </p>
      <p style="color: #667085; font-size: 13px;">If you didn't request this, you can safely ignore this email — your password won't change.</p>
    `),
  };
}

/** Sent after sign-up so we know the address really belongs to the customer. */
export function verifyEmailEmail(name: string, verifyUrl: string) {
  return {
    subject: "Confirm your email for Lycie Investments",
    html: wrapper(`
      <p>Hi ${escapeHtml(name)},</p>
      <p>Welcome to Lycie Investments. Please confirm this is your email address — the link expires in 24 hours and only works once.</p>
      <p style="margin: 24px 0;">
        <a href="${verifyUrl}" style="background: ${BRAND_NAVY}; color: #fff; padding: 10px 20px; border-radius: 4px; text-decoration: none; display: inline-block;">Confirm email</a>
      </p>
      <p style="color: #667085; font-size: 13px;">If you didn't create an account, you can safely ignore this email.</p>
    `),
  };
}

/** Tells the account owner their password changed, so an unexpected change gets noticed quickly. */
export function passwordChangedEmail(name: string) {
  return {
    subject: "Your Lycie Investments password was changed",
    html: wrapper(`
      <p>Hi ${escapeHtml(name)},</p>
      <p>The password for your account was just changed, and any other devices signed in to it were signed out.</p>
      <p style="color: #667085; font-size: 13px;">If this was you, there's nothing more to do. If it wasn't, reset your password straight away and contact us.</p>
    `),
  };
}

export function adminNewSubmissionEmail(formType: string, summaryLines: string[]) {
  return {
    subject: `New ${formType} submission`,
    html: wrapper(`
      <p>A new ${escapeHtml(formType)} was just submitted on the website:</p>
      <ul style="font-size: 14px; padding-left: 18px;">
        ${summaryLines.map((line) => `<li style="margin-bottom: 4px;">${escapeHtml(line)}</li>`).join("")}
      </ul>
      <p style="color: #667085; font-size: 13px;">View full details in the admin dashboard.</p>
    `),
  };
}

/** A message a staff member wrote to a customer (rendered safely: the text is escaped, line breaks kept). */
export function staffMessageEmail(input: { customerName: string; subject: string; body: string; signOff: string }) {
  const paragraphs = input.body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin: 0 0 14px; line-height: 1.55;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  return {
    subject: input.subject,
    html: wrapper(`
      <p style="margin: 0 0 14px;">Hello ${escapeHtml(input.customerName)},</p>
      ${paragraphs}
      <p style="margin: 18px 0 0; color: #667085;">${escapeHtml(input.signOff)}<br>Lycie Investments</p>
    `),
  };
}

/** Tells a customer there is a new message waiting in their Lycie profile (the message itself stays in the app). */
export function profileMessageNotificationEmail(input: { customerName: string; subject: string; accountUrl: string }) {
  return {
    subject: "You have a new message from Lycie Investments",
    html: wrapper(`
      <p style="margin: 0 0 14px;">Hello ${escapeHtml(input.customerName)},</p>
      <p style="margin: 0 0 14px; line-height: 1.55;">We've sent you a message: <strong>${escapeHtml(input.subject)}</strong></p>
      <p style="margin: 0 0 14px;"><a href="${escapeHtml(input.accountUrl)}" style="display: inline-block; background: ${BRAND_NAVY}; color: #fff; padding: 10px 18px; text-decoration: none; border-radius: 4px;">Read it in your account</a></p>
    `),
  };
}

/** Sent to an admin each time their account signs in, so a sign-in they didn't make is noticed at once. */
export function adminSignInAlertEmail(input: { name: string; when: Date; ip: string; device: string; securityUrl: string }) {
  return {
    subject: "New sign-in to your Lycie Investments admin account",
    html: wrapper(`
      <p>Hi ${escapeHtml(input.name)},</p>
      <p>Your admin account was just signed in to.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
        <tr><td style="padding: 6px 0; color: #667085;">When</td><td style="padding: 6px 0; text-align: right;">${escapeHtml(input.when.toUTCString())}</td></tr>
        <tr><td style="padding: 6px 0; color: #667085;">Network address</td><td style="padding: 6px 0; text-align: right;">${escapeHtml(input.ip)}</td></tr>
        <tr><td style="padding: 6px 0; color: #667085;">Device</td><td style="padding: 6px 0; text-align: right;">${escapeHtml(input.device)}</td></tr>
      </table>
      <p style="color: #667085; font-size: 13px;">If this was you, there's nothing to do. If it wasn't, open
        <a href="${escapeHtml(input.securityUrl)}">My Security</a>, choose <strong>Sign out everywhere</strong> and change your password.</p>
    `),
  };
}

/** Sent to the OLD address when a customer's sign-in email is changed, so a hijacked account is noticed. */
export function emailChangedNoticeEmail(input: { name: string; newEmail: string }) {
  return {
    subject: "The email on your Lycie Investments account was changed",
    html: wrapper(`
      <p>Hi ${escapeHtml(input.name)},</p>
      <p>The email address you sign in with was just changed to <strong>${escapeHtml(input.newEmail)}</strong>.</p>
      <p style="color: #667085; font-size: 13px;">If this was you, there's nothing more to do. If it wasn't, contact us straight away so we can secure your account.</p>
    `),
  };
}

export interface AlertVehicle {
  label: string;
  price: string;
  url: string;
}

/** "A vehicle matching your alert has just been listed." */
export function vehicleAlertEmail(input: { name: string; alertLabel: string; vehicles: AlertVehicle[]; manageUrl: string }) {
  return {
    subject: input.vehicles.length === 1 ? `Just listed: ${input.vehicles[0].label}` : `${input.vehicles.length} new vehicles match your alert`,
    html: wrapper(`
      <p>Hi ${escapeHtml(input.name)},</p>
      <p>Good news — ${input.vehicles.length === 1 ? "a vehicle" : "vehicles"} matching your alert <strong>${escapeHtml(input.alertLabel)}</strong> just arrived:</p>
      <ul style="font-size: 14px; padding-left: 18px;">
        ${input.vehicles.map((v) => `<li style="margin-bottom: 6px;"><a href="${escapeHtml(v.url)}">${escapeHtml(v.label)}</a> — ${escapeHtml(v.price)}</li>`).join("")}
      </ul>
      <p style="color: #667085; font-size: 13px;">You're getting this because you set up a vehicle alert. <a href="${escapeHtml(input.manageUrl)}">Change or stop your alerts</a>.</p>
    `),
  };
}

/** "A vehicle you saved is now cheaper." */
export function priceDropEmail(input: { name: string; vehicle: AlertVehicle; oldPrice: string; manageUrl: string }) {
  return {
    subject: `Price drop: ${input.vehicle.label}`,
    html: wrapper(`
      <p>Hi ${escapeHtml(input.name)},</p>
      <p>A vehicle you saved just dropped in price:</p>
      <p style="font-size: 16px;"><a href="${escapeHtml(input.vehicle.url)}"><strong>${escapeHtml(input.vehicle.label)}</strong></a><br>
        <span style="text-decoration: line-through; color: #667085;">${escapeHtml(input.oldPrice)}</span> → <strong>${escapeHtml(input.vehicle.price)}</strong></p>
      <p style="color: #667085; font-size: 13px;">You're getting this because you saved this vehicle. <a href="${escapeHtml(input.manageUrl)}">Manage saved vehicles</a>.</p>
    `),
  };
}

/**
 * Invitation for a new staff member (or a re-sent one): how to sign in, the
 * one-time password, and that it must be changed at first sign-in.
 */
export function staffInviteEmail(input: {
  name: string;
  invitedBy: string;
  position: string;
  email: string;
  tempPassword: string;
  signInUrl: string;
  expiresAt: Date;
  isSystemAdmin: boolean;
}) {
  return {
    subject: input.isSystemAdmin ? "Your Lycie Investments system administrator account" : "You're invited to the Lycie Investments staff workspace",
    html: wrapper(`
      <p>Hi ${escapeHtml(input.name)},</p>
      <p>${escapeHtml(input.invitedBy)} has set up your ${input.isSystemAdmin ? "system administrator" : "staff"} account${input.position ? ` (${escapeHtml(input.position)})` : ""}.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
        <tr><td style="padding: 6px 0; color: #667085;">Sign in at</td><td style="padding: 6px 0; text-align: right;"><a href="${escapeHtml(input.signInUrl)}">${escapeHtml(input.signInUrl)}</a></td></tr>
        <tr><td style="padding: 6px 0; color: #667085;">Email</td><td style="padding: 6px 0; text-align: right;">${escapeHtml(input.email)}</td></tr>
        <tr><td style="padding: 6px 0; color: #667085;">One-time password</td><td style="padding: 6px 0; text-align: right; font-family: 'Courier New', monospace; font-size: 16px; letter-spacing: 1px;"><strong>${escapeHtml(input.tempPassword)}</strong></td></tr>
      </table>
      <p>When you first sign in you'll be asked to choose your own password. This one-time password stops working on ${escapeHtml(input.expiresAt.toUTCString())}.</p>
      ${input.isSystemAdmin ? "<p>System administrator accounts must also turn on two-step verification (an authenticator app) straight after signing in.</p>" : ""}
      <p style="color: #667085; font-size: 13px;">Never share this password. If you weren't expecting this email, you can ignore it, or let us know.</p>
    `),
  };
}

/** Tells an employee their leave request was decided. */
export function leaveDecisionEmail(input: { name: string; approved: boolean; period: string; note?: string | null; reviewer: string }) {
  return {
    subject: `Your leave request was ${input.approved ? "approved" : "declined"}`,
    html: wrapper(`
      <p>Hi ${escapeHtml(input.name)},</p>
      <p>Your leave request for <strong>${escapeHtml(input.period)}</strong> was <strong>${input.approved ? "approved" : "declined"}</strong> by ${escapeHtml(input.reviewer)}.</p>
      ${input.note ? `<p>Note: ${escapeHtml(input.note)}</p>` : ""}
    `),
  };
}

/** Shipment progress for an import or clearing customer. */
export function shipmentUpdateEmail(input: { name: string; title: string; stageLabel: string; message: string; trackUrl: string }) {
  return {
    subject: `Update on ${input.title}: ${input.stageLabel}`,
    html: wrapper(`
      <p>Hi ${escapeHtml(input.name)},</p>
      <p>There's news on <strong>${escapeHtml(input.title)}</strong> — it's now at <strong>${escapeHtml(input.stageLabel)}</strong>.</p>
      <p style="line-height: 1.55;">${escapeHtml(input.message).replace(/\n/g, "<br>")}</p>
      <p style="margin: 20px 0;"><a href="${escapeHtml(input.trackUrl)}" style="background: ${BRAND_NAVY}; color: #fff; padding: 10px 18px; border-radius: 4px; text-decoration: none; display: inline-block;">Track it in your account</a></p>
    `),
  };
}

/** Receipt for a mobile-money payment. */
export function mobilePaymentReceiptEmail(input: { name: string; amount: string; reference: string; purpose: string }) {
  return {
    subject: `Payment received: ${input.amount}`,
    html: wrapper(`
      <p>Hi ${escapeHtml(input.name)},</p>
      <p>We've received your mobile money payment of <strong>${escapeHtml(input.amount)}</strong> (${escapeHtml(input.purpose)}). Reference: <span style="font-family: monospace;">${escapeHtml(input.reference)}</span>.</p>
      <p style="color: #667085; font-size: 13px;">It shows in your account's transaction history.</p>
    `),
  };
}

/** Sent when staff open a shipment: the customer's own tracking code (staff without the privilege never see it). */
export function shipmentOpenedEmail(input: { name: string; title: string; trackingCode: string; trackUrl: string }) {
  return {
    subject: `Your tracking code for ${input.title}`,
    html: wrapper(`
      <p>Hi ${escapeHtml(input.name)},</p>
      <p>We've started tracking <strong>${escapeHtml(input.title)}</strong> for you. Your tracking code is:</p>
      <p style="font-family: 'Courier New', monospace; font-size: 22px; letter-spacing: 2px; margin: 16px 0;"><strong>${escapeHtml(input.trackingCode)}</strong></p>
      <p>Keep it safe — our team will ask for it when you contact us about this vehicle. You can follow its progress any time under <strong>Track my vehicle</strong> in your account:</p>
      <p style="margin: 20px 0;"><a href="${escapeHtml(input.trackUrl)}" style="background: ${BRAND_NAVY}; color: #fff; padding: 10px 18px; border-radius: 4px; text-decoration: none; display: inline-block;">Open my account</a></p>
    `),
  };
}

function summaryRows(rows: Array<[string, string, boolean?]>): string {
  return `
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
      ${rows
        .map(
          ([label, value, bold]) =>
            `<tr><td style="padding: 6px 0; color: #667085;${bold ? " font-weight: bold;" : ""}">${escapeHtml(label)}</td><td style="padding: 6px 0; text-align: right;${bold ? " font-weight: bold;" : ""}">${escapeHtml(value)}</td></tr>`
        )
        .join("")}
    </table>
  `;
}

function accountButton(url: string, label: string): string {
  return `<p style="margin: 20px 0;"><a href="${escapeHtml(url)}" style="background: ${BRAND_NAVY}; color: #fff; padding: 10px 18px; border-radius: 4px; text-decoration: none; display: inline-block;">${escapeHtml(label)}</a></p>`;
}

/** Sent when staff record something a customer bought: what it cost, any saving, and what's left to pay. */
export function purchaseRecordedEmail(input: { name: string; reference: string; title: string; total: string; paid: string; balance: string; saving: string | null; accountUrl: string }) {
  return {
    subject: `Your purchase ${input.reference}: ${input.title}`,
    html: wrapper(`
      <p>Hi ${escapeHtml(input.name)},</p>
      <p>Thank you for your purchase. <strong>${escapeHtml(input.title)}</strong> is now in your account, with every cost and payment.</p>
      ${summaryRows([
        ["Reference", input.reference],
        ...(input.saving ? ([["You saved", input.saving]] as Array<[string, string]>) : []),
        ["Total", input.total, true],
        ["Paid so far", input.paid],
        ["Balance to pay", input.balance, true],
      ])}
      ${accountButton(input.accountUrl, "See it in my account")}
    `),
  };
}

/** Receipt for a payment (or refund) recorded against a purchase. */
export function purchasePaymentReceiptEmail(input: {
  name: string;
  refund: boolean;
  amount: string;
  method: string;
  purchaseReference: string;
  title: string;
  paid: string;
  balance: string;
  accountUrl: string;
}) {
  return {
    subject: input.refund ? `Refund on ${input.purchaseReference}: ${input.amount}` : `Payment received: ${input.amount} for ${input.purchaseReference}`,
    html: wrapper(`
      <p>Hi ${escapeHtml(input.name)},</p>
      <p>${input.refund ? "We've refunded" : "Thank you — we've received"} <strong>${escapeHtml(input.amount)}</strong> (${escapeHtml(input.method)}) for <strong>${escapeHtml(input.title)}</strong>.</p>
      ${summaryRows([
        ["Purchase", input.purchaseReference],
        ["Paid so far", input.paid],
        ["Balance to pay", input.balance, true],
      ])}
      ${accountButton(input.accountUrl, "See my purchases")}
    `),
  };
}

/** The customer paid more than they owed: where the extra went and what they can do with it. */
export function overpaymentEmail(input: { name: string; amount: string; reference: string; title: string; accountUrl: string }) {
  return {
    subject: `You paid ${input.amount} more than you owed`,
    html: wrapper(`
      <p>Hi ${escapeHtml(input.name)},</p>
      <p>Your payment for <strong>${escapeHtml(input.title)}</strong> (${escapeHtml(input.reference)}) was <strong>${escapeHtml(input.amount)}</strong> more than you owed.</p>
      <p>The extra is safe: it's on your <strong>account balance</strong>. You can use it toward another purchase from your account, or contact us if you'd like it refunded.</p>
      ${accountButton(input.accountUrl, "See my balance")}
    `),
  };
}
