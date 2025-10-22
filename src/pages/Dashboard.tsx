import { useAuth } from '@/hooks/useAuth';
import { useDocuments } from '@/hooks/useDocuments';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import { 
  Upload, 
  FileText, 
  User, 
  Folder,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { documents } = useDocuments();
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .maybeSingle();
    if (error) {
        console.error('Error loading profile:', error);
      } else if (data?.full_name) {
        setFullName(data.full_name);
      }
    };
    loadProfile();
  }, [user]);

  // Calculate stats
  const totalDocuments = documents.length;
  const uniqueCategories = new Set(documents.map(doc => doc.category)).size;
  const uniqueFamilyMembers = new Set(documents.map(doc => doc.family_member)).size;
  const totalStorage = documents.reduce((total, doc) => total + doc.file_size, 0);
  const storageLimit = 1024 * 1024 * 1024 * 2; // 2 GB example limit
  const storagePercent = Math.min(100, Math.round((totalStorage / storageLimit) * 100));

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-xl border bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 md:p-8 mb-8 animate-in fade-in-50 slide-in-from-bottom-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <FileText className="h-6 w-6 text-primary" />
                <span className="text-sm text-muted-foreground">Welcome back</span>
          </div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">{fullName ? `Hello, ${fullName}` : 'Family Document Vault'}</h1>
              <p className="text-sm text-muted-foreground mt-2">Quick overview of your vault and shortcuts to get things done.</p>
            </div>
            <div className="flex items-center gap-6">
              <Button asChild>
                <Link to="/uploads"><Folder className="h-4 w-4 mr-2" /> Open</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/profile"><User className="h-4 w-4 mr-2" /> Profile</Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Animated Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 animate-in fade-in-50 slide-in-from-bottom-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Documents</CardTitle>
              <div className="text-2xl font-bold text-foreground">{totalDocuments}</div>
            </CardHeader>
          </Card>
          <Card className="transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 animate-in fade-in-50 slide-in-from-bottom-2 delay-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Family Members</CardTitle>
              <div className="text-2xl font-bold text-foreground">{uniqueFamilyMembers}</div>
            </CardHeader>
          </Card>
          <Card className="transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 animate-in fade-in-50 slide-in-from-bottom-2 delay-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Storage Used</CardTitle>
              <div className="text-2xl font-bold text-foreground">{formatFileSize(totalStorage)}</div>
              <div className="mt-2">
                <Progress value={storagePercent} />
                <div className="mt-1 text-xs text-muted-foreground">{storagePercent}% of 2 GB</div>
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 animate-in fade-in-50 slide-in-from-bottom-4">
          <Card className="hover:shadow-md transition-all">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Add new documents</div>
                <div className="text-foreground font-medium">Upload to your vault</div>
          </div>
              <Button asChild>
                <Link to="/uploads?newFolder=1"><Upload className="h-4 w-4 mr-2" /> Upload</Link>
            </Button>
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-all">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Browse by member</div>
                <div className="text-foreground font-medium">Open folders</div>
              </div>
              <Button variant="outline" asChild>
                <Link to="/uploads"><Folder className="h-4 w-4 mr-2" /> Open</Link>
            </Button>
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-all">
            <CardContent className="p-5 flex items-center justify-between">
                      <div>
                <div className="text-sm text-muted-foreground">Manage your profile</div>
                <div className="text-foreground font-medium">Update details</div>
                        </div>
              <Button variant="ghost" asChild>
                <Link to="/profile"><User className="h-4 w-4 mr-2" /> Edit</Link>
                      </Button>
                </CardContent>
              </Card>
        </div>

        {/* Filters moved to Uploads page */}

        {/* Uploads moved to Uploads page */}

        {/* Document list moved to Uploads page */}

        {/* Empty State */}
        {documents.length === 0 && (
          <Card className="text-center py-12">
            <CardContent>
              <Folder className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No documents yet</h3>
              <p className="text-muted-foreground mb-4">
                Start by uploading your first document
              </p>
              <Button asChild>
                <Link to="/uploads">Go to Uploads</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}