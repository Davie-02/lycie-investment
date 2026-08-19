interface WhatsAppIconProps {
  size?: number;
  className?: string;
}

/**
 * A generic "chat bubble + phone" glyph, not a trace of any specific icon
 * library's copyrighted artwork — built from basic shapes so it's safe to
 * ship, while still reading clearly as "message us" once paired with the
 * brand-green background and WhatsApp label.
 */
export default function WhatsAppIcon({ size = 24, className }: WhatsAppIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle cx="16" cy="16" r="16" fill="#25D366" />
      <path
        d="M22.5 9.5a8.5 8.5 0 0 0-13.6 10.1L8 25l5.5-1.4A8.5 8.5 0 0 0 22.5 9.5Z"
        fill="#fff"
      />
      <path
        d="M12.4 11.2c.2-.5.5-.5.7-.5h.5c.2 0 .4 0 .5.4.2.5.6 1.6.6 1.7.1.1.1.3 0 .4-.1.2-.1.3-.3.4l-.4.5c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.4.1.6-.1l.6-.7c.2-.2.4-.2.6-.1l1.5.7c.2.1.4.2.4.4 0 .2 0 1.1-.4 1.5-.4.5-1.3.9-2 .9-.6 0-1.9-.2-3.6-1.5-2.1-1.6-3.4-3.8-3.5-4-.1-.2-.9-1.3-.9-2.4 0-1.2.6-1.8.8-2Z"
        fill="#25D366"
      />
    </svg>
  );
}
