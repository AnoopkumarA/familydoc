import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { isMobileDevice, canShareFiles, canShareURL, isAndroid, isWebView, debugShareCapabilities } from '@/lib/utils';

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
      // Debug sharing capabilities
      debugShareCapabilities();
      
      // Detect if we're on a mobile device
      const isMobile = isMobileDevice();
      const isAndroidDevice = isAndroid();
      
      // Get file info first to check size
      const { data: blob, error: dlError } = await supabase.storage
        .from('documents')
        .download(document.file_path);

      if (dlError) throw dlError;

      const file = new File([blob], document.name, { type: document.file_type });
      const fileSizeMB = file.size / (1024 * 1024);
      const nav: any = navigator as any;

      console.log('File info:', {
        name: document.name,
        size: fileSizeMB.toFixed(2) + ' MB',
        type: document.file_type
      });

      // PRIORITY 1: Try simple URL sharing first (most reliable)
      if (canShareURL()) {
        try {
          // Create signed URL for sharing
          const { data: linkData, error } = await supabase.storage
            .from('documents')
            .createSignedUrl(document.file_path, 60 * 60 * 24); // 24 hours
          if (error) throw error;
          
          // Try simple sharing first
          const shareData = {
            title: document.name,
            text: `${document.description || 'Document from Family Document Vault'}\n\nFile: ${document.name} (${fileSizeMB.toFixed(1)}MB)`,
            url: linkData.signedUrl
          };
          
          console.log('Attempting to share:', shareData);
          await nav.share(shareData);
          toast({ title: 'Document shared', description: 'Document shared with download link!' });
          return;
        } catch (urlShareError) {
          console.log('URL sharing failed:', urlShareError);
          console.log('Error details:', urlShareError.message);
        }

        // PRIORITY 2: Try sharing file directly (for smaller files)
        if (fileSizeMB < 5 && canShareFiles()) {
          try {
            const canShareFile = nav.canShare({ files: [file] });
            console.log('Can share file:', canShareFile);
            
            if (canShareFile) {
              await nav.share({ 
                files: [file], 
                title: document.name, 
                text: document.description || 'Shared from Family Document Vault' 
              });
              toast({ title: 'Document shared', description: 'Document file shared successfully!' });
              return;
            }
          } catch (shareError) {
            console.log('File sharing failed:', shareError);
            console.log('Error details:', shareError.message);
          }
        }
      }

      // PRIORITY 3: For Android, try alternative sharing methods
      if (isAndroidDevice && isMobile) {
        try {
          const { data: linkData, error } = await supabase.storage
            .from('documents')
            .createSignedUrl(document.file_path, 60 * 60 * 24);
          if (error) throw error;

          // Method 1: Try Android Intent with URL
          if (isWebView()) {
            try {
              const intentUrl = `intent://share#Intent;action=android.intent.action.SEND;type=text/plain;S.android.intent.extra.TEXT=${encodeURIComponent(`${document.name}\n\n${linkData.signedUrl}`)};end`;
              window.location.href = intentUrl;
              toast({ title: 'Opening share', description: 'Opening Android share panel...' });
              return;
            } catch (intentError) {
              console.log('Intent URL failed:', intentError);
            }
          }

          // Method 2: Try to open file directly
          try {
            window.open(linkData.signedUrl, '_blank');
            toast({ title: 'Opening document', description: 'Opening document in default app...' });
            return;
          } catch (openError) {
            console.log('Direct open failed:', openError);
          }

          // Method 3: Email sharing
          try {
            const tempLink = document.createElement('a');
            tempLink.href = `mailto:?subject=${encodeURIComponent(document.name)}&body=${encodeURIComponent(`Document: ${document.name}\n\nDownload: ${linkData.signedUrl}\n\nDescription: ${document.description || 'Shared from Family Document Vault'}`)}`;
            tempLink.click();
            toast({ title: 'Opening email', description: 'Opening email app to share document...' });
            return;
          } catch (emailError) {
            console.log('Email sharing failed:', emailError);
          }
        } catch (androidError) {
          console.log('Android sharing methods failed:', androidError);
        }
      }

      // PRIORITY 4: Final fallback - Copy link to clipboard
      const url = await getShareableLink(document);
      
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        toast({ 
          title: 'Link copied', 
          description: isMobile 
            ? 'Link copied to clipboard. Paste in any app to share.' 
            : 'Paste anywhere to share.' 
        });
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        toast({ 
          title: 'Link copied', 
          description: 'Document link copied to clipboard.' 
        });
      }
    } catch (error: any) {
      console.error('Share error:', error);
      toast({
        variant: 'destructive',
        title: 'Share failed',
        description: error.message || 'Unable to share document. Please try again.',
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