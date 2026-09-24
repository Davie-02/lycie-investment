/**
 * Website wording in English and Chichewa, for the parts of the site that
 * aren't edited in the admin (menus, footer, sign-in, tracking). Text staff
 * write in Website content stays as written.
 *
 * The Chichewa here should be reviewed by a native speaker on the team before
 * launch — adjust any phrase in the `ny` list below; keys must stay the same.
 */
export type Lang = "en" | "ny";

const en = {
  "lang.name": "English",
  "nav.home": "Home",
  "nav.vehicles": "Vehicles",
  "nav.import": "Import",
  "nav.clearing": "Clearing",
  "nav.hire": "Hire",
  "nav.about": "About",
  "nav.contact": "Contact",
  "nav.deals": "Deals",
  "nav.quote": "Get a Quote",
  "nav.account": "My account",
  "nav.signIn": "Sign in",
  "footer.company": "Company",
  "footer.services": "Services",
  "footer.contact": "Contact",
  "footer.about": "About",
  "footer.vehicles": "Vehicles",
  "footer.blog": "Blog",
  "footer.faq": "FAQ",
  "footer.reviews": "Reviews",
  "footer.importing": "Vehicle Importing",
  "footer.sales": "Vehicle Sales",
  "footer.hire": "Vehicle Hire",
  "footer.clearing": "Vehicle Clearing",
  "auth.signIn": "Sign in",
  "auth.signingIn": "Signing in…",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.forgot": "Forgot your password?",
  "auth.newCustomer": "New customer?",
  "auth.createAccount": "Create an account",
};

export type StringKey = keyof typeof en;

const ny: Record<StringKey, string> = {
  "lang.name": "Chichewa",
  "nav.home": "Poyambira",
  "nav.vehicles": "Magalimoto",
  "nav.import": "Kuitanitsa",
  "nav.clearing": "Kasitomu",
  "nav.hire": "Kubwereka",
  "nav.about": "Za Ife",
  "nav.contact": "Lumikizanani",
  "nav.deals": "Mitengo Yapadera",
  "nav.quote": "Funsani Mtengo",
  "nav.account": "Akaunti Yanga",
  "nav.signIn": "Lowani",
  "footer.company": "Kampani",
  "footer.services": "Ntchito Zathu",
  "footer.contact": "Lumikizanani Nafe",
  "footer.about": "Za Ife",
  "footer.vehicles": "Magalimoto",
  "footer.blog": "Nkhani",
  "footer.faq": "Mafunso",
  "footer.reviews": "Ndemanga",
  "footer.importing": "Kuitanitsa Magalimoto",
  "footer.sales": "Kugulitsa Magalimoto",
  "footer.hire": "Kubwereka Magalimoto",
  "footer.clearing": "Kuchotsa Magalimoto ku Kasitomu",
  "auth.signIn": "Lowani",
  "auth.signingIn": "Tikulowetsani…",
  "auth.email": "Imelo",
  "auth.password": "Mawu achinsinsi",
  "auth.forgot": "Mwaiwala mawu achinsinsi?",
  "auth.newCustomer": "Ndinu watsopano?",
  "auth.createAccount": "Pangani akaunti",
};

export const STRINGS: Record<Lang, Record<StringKey, string>> = { en, ny };
