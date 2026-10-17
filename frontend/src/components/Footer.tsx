import { es } from "@/i18n/es";
import { Logo } from "./Navbar";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-border md:mt-32">
      <div className="container-page flex flex-col gap-6 py-12 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">{es.app.footerTagline}</p>
        </div>
        <div className="max-w-md space-y-2 text-xs text-muted-foreground">
          <p>
            {es.app.footer}
            <sup>1</sup>
          </p>
          <p>{es.app.footerNota}</p>
        </div>
      </div>
    </footer>
  );
}
