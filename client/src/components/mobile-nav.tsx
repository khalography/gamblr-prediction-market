import { Link, useLocation } from "wouter";
import { Home, User } from "lucide-react";

export function MobileNav() {
  const [location] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-t md:hidden">
      <div className="flex items-center justify-around h-16 px-4">
        <Link href="/">
          <button
            className={`flex flex-col items-center gap-1 px-6 py-2 rounded-lg transition-colors ${
              location === "/" ? "text-primary" : "text-muted-foreground"
            }`}
            data-testid="mobile-nav-home"
          >
            <Home className="h-5 w-5" />
            <span className="text-xs font-medium">Home</span>
          </button>
        </Link>

        <Link href="/portfolio">
          <button
            className={`flex flex-col items-center gap-1 px-6 py-2 rounded-lg transition-colors ${
              location === "/portfolio" ? "text-primary" : "text-muted-foreground"
            }`}
            data-testid="mobile-nav-user"
          >
            <User className="h-5 w-5" />
            <span className="text-xs font-medium">Profile</span>
          </button>
        </Link>
      </div>
    </nav>
  );
}
