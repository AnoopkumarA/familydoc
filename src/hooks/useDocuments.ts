import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface Document {
  id: string;
  name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  category: string;
  family_member: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export function useDocuments() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchDocuments = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error fetching documents',
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const uploadDocument = async (
    file: File,
    category: string,
    familyMember: string,
    description?: string
  ) => {
    if (!user) throw new Error('User not authenticated');

    try {
      // Upload file to storage under per-family-member folder
      const sanitizedMember = familyMember.replace(/[^a-z0-9-_]/gi, '_');
      const fileName = `${user.id}/${sanitizedMember}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Save document metadata to database
      const { data, error: dbError } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          name: file.name,
          file_path: fileName,
          file_size: file.size,
          file_type: file.type,
          category,
          family_member: familyMember,
          description,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      setDocuments(prev => [data, ...prev]);
      
      toast({
        title: 'Document uploaded successfully',
        description: `${file.name} has been uploaded.`,
      });

      return data;
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: error.message,
      });
      throw error;
    }
  };

  const downloadDocument = async (document: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(document.file_path);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.name;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Download started',
        description: `${document.name} is downloading.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Download failed',
        description: error.message,
      });
    }
  };

  const getShareableLink = async (document: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(document.file_path, 60 * 60 * 24); // 24 hours

      if (error) throw error;

      // Copy to clipboard
      await navigator.clipboard.writeText(data.signedUrl);
      
      toast({
        title: 'Link copied to clipboard',
        description: 'Shareable link valid for 24 hours.',
      });

      return data.signedUrl;
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to create share link',
        description: error.message,
      });
      throw error;
    }
  };

  const shareDocument = async (document: Document) => {
    try {
      // Check if we're in a mobile environment (APK/Capacitor)
      const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isCapacitor = !!(window as any).Capacitor;
      
      // Try to download the file for native sharing
      const { data: blob, error: dlError } = await supabase.storage
        .from('documents')
        .download(document.file_path);

      if (dlError) throw dlError;

      const file = new File([blob], document.name, { type: document.file_type });
      const nav: any = navigator as any;

      // For mobile APK environments, try different sharing approaches
      if (isMobile || isCapacitor) {
        // Try native file sharing first
        if (nav && typeof nav.share === 'function') {
          try {
            // Check if we can share files
            if (typeof nav.canShare === 'function' && nav.canShare({ files: [file] })) {
              await nav.share({ 
                files: [file], 
                title: document.name, 
                text: document.description || 'Shared from Family Document Vault' 
              });
              toast({ title: 'Share dialog opened', description: 'Use your device to share the file.' });
              return;
            }
          } catch (fileShareError) {
            console.log('File sharing failed, trying URL sharing:', fileShareError);
          }
        }

        // Try URL sharing for mobile
        if (nav && typeof nav.share === 'function') {
          try {
            const { data: linkData, error } = await supabase.storage
              .from('documents')
              .createSignedUrl(document.file_path, 60 * 60 * 24);
            if (error) throw error;
            
            await nav.share({ 
              title: document.name, 
              text: document.description || 'Document link', 
              url: linkData.signedUrl 
            });
            toast({ title: 'Share dialog opened', description: 'A shareable link was used.' });
            return;
          } catch (urlShareError) {
            console.log('URL sharing failed:', urlShareError);
          }
        }

        // For Capacitor, try the native plugin
        if (isCapacitor && (window as any).Capacitor?.Plugins?.Share) {
          try {
            const { data: linkData, error } = await supabase.storage
              .from('documents')
              .createSignedUrl(document.file_path, 60 * 60 * 24);
            if (error) throw error;
            
            await (window as any).Capacitor.Plugins.Share.share({
              title: document.name,
              text: document.description || 'Document link',
              url: linkData.signedUrl,
            });
            toast({ title: 'Share dialog opened', description: 'Native sharing activated.' });
            return;
          } catch (capacitorError) {
            console.log('Capacitor sharing failed:', capacitorError);
          }
        }
      } else {
        // Desktop/Web sharing logic
        if (nav && typeof nav.share === 'function' && typeof nav.canShare === 'function' && nav.canShare({ files: [file] })) {
          await nav.share({ files: [file], title: document.name, text: document.description || 'Shared from Family Document Vault' });
          toast({ title: 'Share dialog opened', description: 'Use your device to share the file.' });
          return;
        }

        // Fallback: share with URL if files are not supported
        if (nav && typeof nav.share === 'function') {
          const { data: linkData, error } = await supabase.storage
            .from('documents')
            .createSignedUrl(document.file_path, 60 * 60 * 24);
          if (error) throw error;
          await nav.share({ title: document.name, text: document.description || 'Document link', url: linkData.signedUrl });
          toast({ title: 'Share dialog opened', description: 'A shareable link was used.' });
          return;
        }
      }

      // Final fallback: copy link to clipboard
      const url = await getShareableLink(document);
      await navigator.clipboard.writeText(url);
      toast({ title: 'Link copied', description: 'Paste anywhere to share.' });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Share failed',
        description: error.message,
      });
    }
  };

  const deleteDocument = async (documentId: string, filePath: string) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([filePath]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);

      if (dbError) throw dbError;

      setDocuments(prev => prev.filter(doc => doc.id !== documentId));
      
      toast({
        title: 'Document deleted',
        description: 'Document has been permanently deleted.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: error.message,
      });
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [user]);

  return {
    documents,
    loading,
    uploadDocument,
    downloadDocument,
    getShareableLink,
    shareDocument,
    deleteDocument,
    refetch: fetchDocuments,
  };
}