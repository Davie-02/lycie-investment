import { IsIn, IsOptional } from "class-validator";

export const PREFERRED_CONTACTS = ["whatsapp", "call", "email", "message"] as const;
export type PreferredContact = (typeof PREFERRED_CONTACTS)[number];

/** Mix-in field used by every public request form. */
export const PreferredContactField = () => (target: object, key: string) => {
  IsOptional()(target, key);
  IsIn(PREFERRED_CONTACTS)(target, key);
};
