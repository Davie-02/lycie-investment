/** "EN | NY" switch in the site header. */
import { useLanguage } from "./LanguageContext";

export default function LanguageSwitch({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLanguage();
  return (
    <div className={`language-switch ${className}`} role="group" aria-label="Language / Chiyankhulo">
      {(["en", "ny"] as const).map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          aria-pressed={lang === code}
          className={lang === code ? "language-switch__option language-switch__option--on" : "language-switch__option"}
          onClick={() => setLang(code)}
          title={code === "en" ? "English" : "Chichewa"}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
