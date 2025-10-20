import { Link, NavLink } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { FileText, User, Menu, LogOut, Folder, LayoutDashboard } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export default function SiteNav() {
  const [open, setOpen] = useState(false);
  const { signOut } = useAuth();
  const { toast } = useToast();

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast({ variant: 'destructive', title: 'Sign out failed', description: error.message });
    } else {
      toast({ title: 'Signed out', description: 'You have been signed out.' });
    }
    setOpen(false);
  };
  return (
    <header className="border-b bg-card">
      <div className="container mx-auto px-4 py-4">
        {/* Mobile: menu left, logo right */}
        <div className="flex items-center justify-between md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Open menu">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-4 flex flex-col h-full">
              <nav className="flex flex-col items-center justify-center gap-4 text-base flex-1">
                <NavLink
                  to="/"
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    (isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/40 text-foreground hover:bg-muted') +
                    ' w-56 text-center px-5 py-3 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2'
                  }
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </NavLink>
                <NavLink
                  to="/uploads?newFolder=1"
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    (isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/40 text-foreground hover:bg-muted') +
                    ' w-56 text-center px-5 py-3 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2'
                  }
                >
                  <Folder className="h-4 w-4" />
                  Uploads
                </NavLink>
                <NavLink
                  to="/uploads"
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    (isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/40 text-foreground hover:bg-muted') +
                    ' w-56 text-center px-5 py-3 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2'
                  }
                >
                  <Folder className="h-4 w-4" />
                  Open folders
                </NavLink>
                <NavLink
                  to="/profile"
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    (isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/40 text-foreground hover:bg-muted') +
                    ' w-56 text-center px-5 py-3 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2'
                  }
                >
                  <User className="h-4 w-4" />
                  Profile
                </NavLink>
              </nav>
              <div className="mt-auto pt-6">
                <Button variant="outline" onClick={handleSignOut} className="w-full">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          <Link to="/" className="flex items-center gap-2">
            <span className="font-semibold text-foreground">Family Doc</span>
            <FileText className="h-6 w-6 text-primary" />
          </Link>
        </div>

        {/* Desktop: logo left, nav right */}
        <div className="hidden md:flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <span className="font-semibold text-foreground">Family Doc</span>
            <FileText className="h-6 w-6 text-primary" />
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <NavLink to="/" className={({ isActive }) => isActive ? 'text-primary' : 'text-foreground hover:text-primary'}>
              Dashboard
            </NavLink>
            <NavLink to="/uploads" className={({ isActive }) => isActive ? 'text-primary' : 'text-foreground hover:text-primary'}>
              Uploads
            </NavLink>
            <NavLink to="/profile" className={({ isActive }) => isActive ? 'text-primary flex items-center gap-1' : 'text-foreground hover:text-primary flex items-center gap-1'}>
              <User className="h-4 w-4" />
              Profile
            </NavLink>
          </nav>
        </div>
      </div>
    </header>
  );
}


