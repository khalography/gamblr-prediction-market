import { ExternalLink } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 mt-auto">
      <div className="container px-4 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col items-center md:items-start gap-2">
            <p className="text-sm text-foreground">
              Gamblr - Decentralized Prediction Markets
            </p>
            <p className="text-xs text-muted-foreground">
              Built on Arc Network Testnet. This is a testnet application - no real funds are at risk.
            </p>
          </div>
          
          <div className="flex flex-col items-center md:items-end gap-2">
            <a 
              href="https://docs.arc.network/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
              data-testid="link-arc-docs"
            >
              Learn more about Arc Network
              <ExternalLink className="h-3 w-3" />
            </a>
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} Gamblr. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
