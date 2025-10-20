import { Link } from 'react-router-dom';

export default function SiteFooter() {
  return (
    <footer className="border-t mt-12">
      <div className="container mx-auto px-4 py-6 flex items-center justify-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Family Document Vault
      </div>
    </footer>
  );
}


