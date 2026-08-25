const BRAND_NAVY = "#19406C";
const BRAND_LIGHT = "#76CAE9";

function wrapper(bodyHtml: string): string {
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto;">
      <div style="background: ${BRAND_NAVY}; padding: 20px 24px;">
        <span style="color: #fff; font-size: 18px; font-weight: bold;">Lycie <span style="color: ${BRAND_LIGHT};">Investment</span></span>
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
      <tr><td style="padding: 6px 0; color: #667085;">Vehicle</td><td style="padding: 6px 0; text-align: right;">${details.vehicleName}</td></tr>
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
      <p>Hi ${details.fullName},</p>
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
      <p>Hi ${details.fullName},</p>
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
      <p>Hi ${details.fullName},</p>
      <p>Your hire booking for the following has been cancelled:</p>
      ${hireSummaryTable(details)}
      <p>If this wasn't expected, please get in touch and we'll help sort it out.</p>
    `),
  };
}

export function hireBookingCompletedEmail(details: HireEmailDetails) {
  return {
    subject: "Thanks for hiring with Lycie Investment",
    html: wrapper(`
      <p>Hi ${details.fullName},</p>
      <p>Thanks for hiring the ${details.vehicleName} with us — we hope it served you well. We'd love to help again next time you need a vehicle.</p>
    `),
  };
}

export function hireDueSoonReminderEmail(details: HireEmailDetails) {
  return {
    subject: `Reminder: your ${details.vehicleName} hire is due back soon`,
    html: wrapper(`
      <p>Hi ${details.fullName},</p>
      <p>Just a reminder that your hired ${details.vehicleName} is due back on <strong>${details.returnDate.toLocaleDateString()}</strong>.</p>
      <p>Please arrange the return, or contact us if you'd like to extend the hire.</p>
    `),
  };
}

export function hireOverdueReminderEmail(details: HireEmailDetails) {
  return {
    subject: `Overdue: your ${details.vehicleName} hire return`,
    html: wrapper(`
      <p>Hi ${details.fullName},</p>
      <p>Our records show the ${details.vehicleName} was due back on <strong>${details.returnDate.toLocaleDateString()}</strong> and hasn't been returned yet.</p>
      <p>Please contact us as soon as possible to arrange the return.</p>
    `),
  };
}

export function adminNewSubmissionEmail(formType: string, summaryLines: string[]) {
  return {
    subject: `New ${formType} submission`,
    html: wrapper(`
      <p>A new ${formType} was just submitted on the website:</p>
      <ul style="font-size: 14px; padding-left: 18px;">
        ${summaryLines.map((line) => `<li style="margin-bottom: 4px;">${line}</li>`).join("")}
      </ul>
      <p style="color: #667085; font-size: 13px;">View full details in the admin dashboard.</p>
    `),
  };
}
