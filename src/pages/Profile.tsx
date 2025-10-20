import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Phone, User as UserIcon, Upload, Camera } from 'lucide-react';

export default function Profile() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) {
        toast({ variant: 'destructive', title: 'Failed to load profile', description: error.message });
      } else if (data) {
        setFullName(data.full_name || '');
        setAvatarUrl(data.avatar_url || '');
      }
      // Load phone from user metadata
      const metaPhone = (user.user_metadata as any)?.phone || '';
      setPhone(metaPhone);
      setLoading(false);
    };
    loadProfile();
  }, [user, toast]);

  const saveProfile = async () => {
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .upsert({ user_id: user.id, full_name: fullName, avatar_url: avatarUrl }, { onConflict: 'user_id' });
    if (error) {
      toast({ variant: 'destructive', title: 'Failed to save profile', description: error.message });
    } else {
      // Save phone into auth user metadata
      const { error: metaErr } = await supabase.auth.updateUser({ data: { phone } });
      if (metaErr) {
        toast({ variant: 'destructive', title: 'Failed to save phone', description: metaErr.message });
        return;
      }
      toast({ title: 'Profile saved', description: 'Your profile has been updated.' });
    }
  };

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast({ variant: 'destructive', title: 'Sign out failed', description: error.message });
    } else {
      toast({ title: 'Signed out', description: 'You have been signed out.' });
      navigate('/auth');
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: 'Invalid file type', description: 'Please select an image file.' });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'File too large', description: 'Please select an image smaller than 5MB.' });
      return;
    }

    setUploadingAvatar(true);
    try {
      // Upload to Supabase storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      setAvatarUrl(publicUrl);
      toast({ title: 'Avatar uploaded', description: 'Your profile photo has been updated.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Upload failed', description: error.message });
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 md:p-8 mb-8 animate-in fade-in-50 slide-in-from-bottom-4">
        <div className="flex items-center gap-3 mb-1">
          <UserIcon className="h-5 w-5 text-primary" />
          <span className="text-sm text-muted-foreground">Your Profile</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">{fullName || user?.email || 'Profile'}</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your personal information and contact details.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Info */}
        <Card className="transition-all hover:shadow-md">
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Full Name</label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Email</label>
              <Input value={user?.email || ''} disabled />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Profile Photo</label>
              <div className="flex items-center gap-4">
                <div className="relative">
                  {avatarUrl ? (
                    <img 
                      src={avatarUrl} 
                      alt="Profile" 
                      className="w-16 h-16 rounded-full object-cover border-2 border-border"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center border-2 border-border">
                      <UserIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                    id="avatar-upload"
                    disabled={uploadingAvatar}
                  />
                  <label htmlFor="avatar-upload">
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      className="cursor-pointer"
                      disabled={uploadingAvatar}
                      asChild
                    >
                      <span>
                        {uploadingAvatar ? (
                          <>
                            <Upload className="h-4 w-4 mr-2 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Camera className="h-4 w-4 mr-2" />
                            Upload Photo
                          </>
                        )}
                      </span>
                    </Button>
                  </label>
                  <p className="text-xs text-muted-foreground mt-1">JPG, PNG up to 5MB</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Info */}
        <Card className="transition-all hover:shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Phone className="h-5 w-5 text-primary" /> Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Phone Number</label>
              <Input type="tel" inputMode="tel" placeholder="+1 555 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <p className="text-xs text-muted-foreground">We use this to personalize your sharing and notifications.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between mt-6">
        <Button variant="destructive" onClick={handleSignOut}>Sign Out</Button>
        <Button onClick={saveProfile} disabled={loading}>Save Changes</Button>
      </div>
    </div>
  );
}


