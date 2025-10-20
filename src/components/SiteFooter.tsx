import { Link } from 'react-router-dom';

export default function SiteFooter() {
  return (
    <footer className="border-t mt-12">
      <div className="container mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <div>
          © {new Date().getFullYear()} Family Document Vault
        </div>
        <div className="flex items-center gap-4">
          <Link to="/uploads" className="hover:text-foreground">Uploads</Link>
          <a href="https://supabase.com" target="_blank" rel="noreferrer" className="hover:text-foreground">Supabase</a>
          <a href="https://react.dev" target="_blank" rel="noreferrer" className="hover:text-foreground">React</a>
        </div>
      </div>
    </footer>
  );
}


