import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useDocuments } from '@/hooks/useDocuments';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { DocumentUpload } from '@/components/DocumentUpload';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Search, 
  Plus, 
  Share2,
  Download,
  Trash2,
  FileText,
  Folder,
  Pencil,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { canShareURL } from '@/lib/utils';

export default function Uploads() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { documents, loading, downloadDocument, getShareableLink, shareDocument, deleteDocument, refetch } = useDocuments();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showUpload, setShowUpload] = useState(false);
  const { member } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const categories = ['All', 'Identity', 'Certificates', 'Bills', 'Insurance', 'Medical', 'Legal', 'Financial'];
  const defaultMembers = ['Father', 'Mother', 'Child', 'Self', 'Spouse', 'Other'];
  const [customMembers, setCustomMembers] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [memberPhotos, setMemberPhotos] = useState<Record<string, string>>({});
  const [newMemberPhotoPreview, setNewMemberPhotoPreview] = useState<string>('');
  const [newMemberPhotoFile, setNewMemberPhotoFile] = useState<File | null>(null);

  // Load custom members from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('fd.customMembers');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setCustomMembers(parsed.filter((v) => typeof v === 'string'));
        }
      } catch {}
    }
    const storedPhotos = localStorage.getItem('fd.memberPhotos');
    if (storedPhotos) {
      try {
        const parsed = JSON.parse(storedPhotos);
        if (parsed && typeof parsed === 'object') {
          setMemberPhotos(parsed as Record<string, string>);
        }
      } catch {}
    }
  }, []);

  const membersFromDocs = useMemo(() => {
    const set = new Set<string>();
    documents.forEach((d) => {
      if (d.family_member) set.add(d.family_member);
    });
    return Array.from(set);
  }, [documents]);

  const allMembers = useMemo(() => {
    // Show only members that actually exist (from documents) or custom-created ones
    const set = new Set<string>([...membersFromDocs, ...customMembers]);
    return Array.from(set);
  }, [membersFromDocs, customMembers]);

  const currentMember = useMemo(() => {
    if (!member) return 'All';
    const found = allMembers.find((m) => m.toLowerCase() === member.toLowerCase());
    if (found) return found;
    // Fallback to capitalized member from URL
    const pretty = decodeURIComponent(member).replace(/[-_]+/g, ' ');
    return pretty.charAt(0).toUpperCase() + pretty.slice(1);
  }, [member, allMembers]);

  const isMemberView = Boolean(member);

  // Ensure upload section is closed by default whenever navigating between folders
  useEffect(() => {
    setShowUpload(false);
    const initial = (currentMember && currentMember !== 'All') ? currentMember : '';
    setRenameValue(initial);
  }, [member, currentMember]);

  // Open "Create New Folder" dialog when requested via query param
  useEffect(() => {
    if (!isMemberView && searchParams.get('newFolder') === '1') {
      setIsDialogOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('newFolder');
      setSearchParams(next, { replace: true });
    }
  }, [isMemberView, searchParams, setSearchParams]);

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || doc.category === selectedCategory;
    const matchesMember = !currentMember || currentMember === 'All' ? true : doc.family_member === currentMember;
    return matchesSearch && matchesCategory && matchesMember;
  });

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
    <div className="container mx-auto px-4 py-8">
      {!isMemberView ? (
        <>
           <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
             <h2 className="text-xl font-semibold text-foreground">Choose a Family Member</h2>
             <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) { setNewMemberPhotoPreview(''); setNewMemberPhotoFile(null); } }}>
               <DialogTrigger asChild>
                 <Button size="sm" className="w-auto ml-auto sm:ml-0">
                   <Plus className="h-3 w-3 mr-1" />
                   New Folder
                 </Button>
               </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Folder</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <Input
                    placeholder="Family member name"
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                  />
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">Upload photo (optional)</label>
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full overflow-hidden bg-muted flex items-center justify-center">
                        {newMemberPhotoPreview ? (
                          <img src={newMemberPhotoPreview} alt="Preview" className="h-full w-full object-cover" />
                        ) : (
                          <div className="text-xs text-muted-foreground">No image</div>
                        )}
                      </div>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setNewMemberPhotoFile(file);
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = () => setNewMemberPhotoPreview(reader.result as string);
                            reader.readAsDataURL(file);
                          } else {
                            setNewMemberPhotoPreview('');
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => {
                      const name = newMemberName.trim();
                      if (!name) return;
                      // Prevent duplicates (case-insensitive)
                      const exists = allMembers.some((m) => m.toLowerCase() === name.toLowerCase());
                      if (exists) {
                        setIsDialogOpen(false);
                        setNewMemberName('');
                        setNewMemberPhotoPreview('');
                        setNewMemberPhotoFile(null);
                        navigate(`/uploads/folder/${name.toLowerCase()}`);
                        return;
                      }
                      const next = [...customMembers, name];
                      setCustomMembers(next);
                      localStorage.setItem('fd.customMembers', JSON.stringify(next));
                      if (newMemberPhotoPreview) {
                        const photos = { ...memberPhotos, [name]: newMemberPhotoPreview };
                        setMemberPhotos(photos);
                        localStorage.setItem('fd.memberPhotos', JSON.stringify(photos));
                      }
                      setIsDialogOpen(false);
                      setNewMemberName('');
                      setNewMemberPhotoPreview('');
                      setNewMemberPhotoFile(null);
                      navigate(`/uploads/folder/${name.toLowerCase()}`);
                    }}
                  >
                    Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {allMembers.map((fm) => (
              <Card key={fm} className="group hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/uploads/folder/${fm.toLowerCase()}`)}>
                <CardContent className="relative p-6 flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center">
                    {memberPhotos[fm] ? (
                      <img src={memberPhotos[fm]} alt={`${fm}`} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs text-primary font-medium">{fm.slice(0,1)}</span>
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">{fm}</h3>
                    <p className="text-xs text-muted-foreground">View and manage {fm.toLowerCase()} documents</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(fm);
                      setIsDeleteOpen(true);
                    }}
                    title="Delete folder"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Delete confirmation */}
          <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete folder?</AlertDialogTitle>
                <AlertDialogDescription>
                  {deleteTarget ? `This will remove the '${deleteTarget}' folder from your view. Folders with documents cannot be deleted.` : ''}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (!deleteTarget) return;
                    const hasDocs = documents.some((d) => d.family_member.toLowerCase() === deleteTarget.toLowerCase());
                    if (hasDocs) {
                      toast({ variant: 'destructive', title: 'Cannot delete', description: 'This folder contains documents.' });
                      setIsDeleteOpen(false);
                      setDeleteTarget(null);
                      return;
                    }
                    const next = customMembers.filter((m) => m.toLowerCase() !== deleteTarget.toLowerCase());
                    setCustomMembers(next);
                    localStorage.setItem('fd.customMembers', JSON.stringify(next));
                    if (memberPhotos[deleteTarget]) {
                      const { [deleteTarget]: _removed, ...rest } = memberPhotos;
                      setMemberPhotos(rest);
                      localStorage.setItem('fd.memberPhotos', JSON.stringify(rest));
                    }
                    setIsDeleteOpen(false);
                    setDeleteTarget(null);
                    toast({ title: 'Folder deleted', description: 'The folder was removed.' });
                  }}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : (
        <>
          {/* Actions Bar (member view only) */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setShowUpload(!showUpload)}>
                <Plus className="h-4 w-4 mr-2" />
                Upload Document
              </Button>
            </div>
          </div>

          {/* Member header and rename */}
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-semibold text-foreground">{currentMember} Documents</h2>
            <Button variant="ghost" size="sm" onClick={() => setIsRenameOpen(true)} className="gap-2">
              <Pencil className="h-4 w-4" /> Rename
            </Button>
          </div>

          {/* Rename dialog */}
          <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Rename Folder</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                <Input
                  placeholder="New family member name"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button
                  onClick={async () => {
                    const nextName = renameValue.trim();
                    if (!nextName || nextName.toLowerCase() === (currentMember || '').toLowerCase()) {
                      setIsRenameOpen(false);
                      return;
                    }
                    const exists = allMembers
                      .filter((m) => m.toLowerCase() !== (currentMember || '').toLowerCase())
                      .some((m) => m.toLowerCase() === nextName.toLowerCase());
                    if (exists) {
                      toast({ variant: 'destructive', title: 'Folder exists', description: 'A folder with that name already exists.' });
                      return;
                    }
                    try {
                      if (!user) throw new Error('Not authenticated');
                      const { error } = await supabase
                        .from('documents')
                        .update({ family_member: nextName })
                        .eq('user_id', user.id)
                        .eq('family_member', currentMember);
                      if (error) throw error;
                      const idx = customMembers.findIndex((m) => m.toLowerCase() === (currentMember || '').toLowerCase());
                      if (idx !== -1) {
                        const updated = [...customMembers];
                        updated[idx] = nextName;
                        setCustomMembers(updated);
                        localStorage.setItem('fd.customMembers', JSON.stringify(updated));
                      }
                      setIsRenameOpen(false);
                      setSelectedCategory('All');
                      setSearchQuery('');
                      navigate(`/uploads/folder/${nextName.toLowerCase()}`);
                      refetch();
                      toast({ title: 'Folder renamed', description: `Renamed to ${nextName}.` });
                    } catch (e: any) {
                      toast({ variant: 'destructive', title: 'Rename failed', description: e.message });
                    }
                  }}
                >
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Category Filter (member view only) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">Category</span>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Upload Area */}
          {showUpload && (
            <div className="mb-8">
              <DocumentUpload onSuccess={() => {
                setShowUpload(false);
                refetch();
              }} fixedFamilyMember={currentMember && currentMember !== 'All' ? currentMember : undefined} />
            </div>
          )}

          {/* Documents List */}
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading documents...</p>
              </div>
            ) : (
              filteredDocuments.map((doc) => (
                <Card key={doc.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 sm:p-6">
                    {/* Mobile: Stack vertically, Desktop: Horizontal */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-start gap-3 sm:gap-4">
                        <div className="bg-primary/10 p-2 sm:p-3 rounded-lg flex-shrink-0">
                          <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium text-foreground text-sm sm:text-base break-words">{doc.name}</h3>
                          <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">{doc.category}</Badge>
                            <Badge variant="secondary" className="text-xs">{doc.family_member}</Badge>
                          </div>
                          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                            Uploaded on {new Date(doc.created_at).toLocaleDateString()} • {formatFileSize(doc.file_size)} • {doc.file_type.split('/')[1]?.toUpperCase() || 'FILE'}
                          </p>
                          {doc.description && (
                            <p className="text-xs text-muted-foreground mt-1 break-words">{doc.description}</p>
                          )}
                        </div>
                      </div>

                      {/* Action buttons - single row */}
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="flex-1 sm:w-auto"
                          onClick={() => shareDocument(doc)}
                          title={canShareURL() ? "Share via native share panel" : "Copy link to clipboard"}
                        >
                          <Share2 className="h-4 w-4 sm:mr-2" />
                          <span className="sm:inline">Share</span>
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="flex-1 sm:w-auto"
                          onClick={() => downloadDocument(doc)}
                        >
                          <Download className="h-4 w-4 sm:mr-2" />
                          <span className="sm:inline">Download</span>
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="flex-1 sm:w-auto"
                          onClick={() => deleteDocument(doc.id, doc.file_path)}
                        >
                          <Trash2 className="h-4 w-4 sm:mr-2" />
                          <span className="sm:inline">Delete</span>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}


