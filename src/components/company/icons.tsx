const base = { width: 26, height: 26, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

export const SchoolIcon = () => (
  <svg {...base}><path d="M3 9.5 12 5l9 4.5-9 4.5-9-4.5Z" /><path d="M7 12v4c0 1.2 2.2 2.5 5 2.5s5-1.3 5-2.5v-4M21 9.5V15" /></svg>
);
export const HospitalIcon = () => (
  <svg {...base}><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M12 8v8M8 12h8" /></svg>
);
export const GovernmentIcon = () => (
  <svg {...base}><path d="M3 9.5 12 4l9 5.5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" /></svg>
);
export const TruckIcon = () => (
  <svg {...base} width={44} height={44}><path d="M2 6.5h11v9H2zM13 9.5h4.2l3.3 3.3v2.7H13" /><circle cx="6.5" cy="17.5" r="1.8" /><circle cx="16.5" cy="17.5" r="1.8" /></svg>
);
export const ShieldIcon = () => (
  <svg {...base}><path d="M12 3 5 6v5.5c0 4.2 2.9 7.4 7 9 4.1-1.6 7-4.8 7-9V6l-7-3Z" /><path d="m9 12 2.2 2.2L15.5 10" /></svg>
);
export const ClockIcon = () => (
  <svg {...base}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
);
export const HandshakeIcon = () => (
  <svg {...base}><path d="m3 11 4-3.5 3 1.5 3-1.5 4 3.5M3 11l5 5.5c.8.9 2 1 2.9.3L12 16m0 0 1.6 1.3c.8.7 2 .6 2.7-.2L21 11M12 16l-2-2" /></svg>
);
export const LeafIcon = () => (
  <svg {...base}><path d="M5 19c0-8 5-13 15-14 0 10-5 15-13 15" /><path d="M5 19c2-4 5-7 9-9" /></svg>
);
export const PinIcon = () => (
  <svg {...base}><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21Z" /><circle cx="12" cy="10" r="2.3" /></svg>
);
export const PhoneIcon = () => (
  <svg {...base}><path d="M5 4h3.5l1.7 4.3-2.2 1.4a11 11 0 0 0 5 5l1.4-2.2L19 14.5V18a2 2 0 0 1-2 2A13 13 0 0 1 3 6a2 2 0 0 1 2-2Z" /></svg>
);
export const MailIcon = () => (
  <svg {...base}><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="m4 7.5 8 6 8-6" /></svg>
);
