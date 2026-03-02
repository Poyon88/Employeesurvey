import { BarChart3 } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 py-10 sm:flex-row sm:px-6 lg:px-8">
        {/* Left: Logo + copyright */}
        <div className="flex flex-col items-center gap-2 sm:items-start">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-5 text-white" />
            <span className="font-semibold text-white">PulseSurvey</span>
          </div>
          <p className="text-sm">&copy; 2026 PulseSurvey</p>
        </div>

        {/* Right: Links */}
        <div className="flex flex-wrap items-center gap-6 text-sm">
          <a href="#" className="transition-colors hover:text-white">
            Mentions légales
          </a>
          <a href="#" className="transition-colors hover:text-white">
            Politique de confidentialité
          </a>
          <a href="#" className="transition-colors hover:text-white">
            Contact
          </a>
        </div>
      </div>
    </footer>
  );
}
