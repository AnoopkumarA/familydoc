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
      
      // Download the file for sharing
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

      // PRIORITY 1: Try to share the actual file (not link)
      if (canShareURL()) {
        // First try: Share file directly (for smaller files only)
        if (canShareFiles() && fileSizeMB < 10) {
          try {
            const canShareFile = nav.canShare({ files: [file] });
            console.log('Can share file:', canShareFile, 'File size:', fileSizeMB + 'MB');
            
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

        // Second try: Create a temporary download link and share that
        try {
          // Create a blob URL for the file
          const blobUrl = URL.createObjectURL(blob);
          
          // Try sharing with blob URL
          await nav.share({ 
            title: document.name, 
            text: document.description || 'Shared from Family Document Vault',
            url: blobUrl
          });
          
          // Clean up the blob URL after a delay
          setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
          
          toast({ title: 'Document shared', description: 'Document file shared successfully!' });
          return;
        } catch (blobShareError) {
          console.log('Blob URL sharing failed:', blobShareError);
          URL.revokeObjectURL(blobUrl);
        }
      }

      // PRIORITY 1.5: Force download approach for file sharing
      try {
        // Create a blob URL for the file
        const blobUrl = URL.createObjectURL(blob);
        
        // Create a temporary anchor element to trigger download
        const tempAnchor = document.createElement('a');
        tempAnchor.href = blobUrl;
        tempAnchor.download = document.name;
        tempAnchor.style.display = 'none';
        document.body.appendChild(tempAnchor);
        tempAnchor.click();
        document.body.removeChild(tempAnchor);
        
        // Clean up the blob URL
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
        
        toast({ 
          title: 'Document downloaded', 
          description: 'Document downloaded to your device. You can now share it from your downloads folder or file manager.' 
        });
        return;
      } catch (downloadError) {
        console.log('Download approach failed:', downloadError);
      }

      // PRIORITY 2: For Android, try alternative file sharing methods
      if (isAndroidDevice && isMobile) {
        try {
          // Method 1: Try Android Intent with file data
          if (isWebView()) {
            try {
              // Convert file to base64 for Android Intent
              const reader = new FileReader();
              const base64Promise = new Promise<string>((resolve, reject) => {
                reader.onload = () => {
                  const result = reader.result as string;
                  const base64 = result.split(',')[1];
                  resolve(base64);
                };
                reader.onerror = reject;
              });
              reader.readAsDataURL(blob);
              const base64Data = await base64Promise;

              // Create data URL for Android Intent
              const dataUrl = `data:${document.file_type};base64,${base64Data}`;
              const intentUrl = `intent://share#Intent;action=android.intent.action.SEND;type=${document.file_type};S.android.intent.extra.STREAM=${encodeURIComponent(dataUrl)};S.android.intent.extra.TEXT=${encodeURIComponent(document.name)};end`;
              
              window.location.href = intentUrl;
              toast({ title: 'Opening share', description: 'Opening Android share panel with document...' });
              return;
            } catch (intentError) {
              console.log('Intent with file data failed:', intentError);
            }
          }

          // Method 2: Try to open file directly in browser
          try {
            const blobUrl = URL.createObjectURL(blob);
            window.open(blobUrl, '_blank');
            toast({ title: 'Opening document', description: 'Opening document in browser. You can now share it from there.' });
            return;
          } catch (openError) {
            console.log('Direct open failed:', openError);
          }
        } catch (androidError) {
          console.log('Android file sharing methods failed:', androidError);
        }
      }

      // PRIORITY 3: Fallback - Try simple download approach
      try {
        // Create a simple download link
        const blobUrl = URL.createObjectURL(blob);
        
        // Create a temporary anchor element to trigger download
        const tempAnchor = document.createElement('a');
        tempAnchor.href = blobUrl;
        tempAnchor.download = document.name;
        tempAnchor.style.display = 'none';
        document.body.appendChild(tempAnchor);
        tempAnchor.click();
        document.body.removeChild(tempAnchor);
        
        // Clean up the blob URL
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
        
        toast({ 
          title: 'Document downloaded', 
          description: 'Document downloaded to your device. You can now share it from your downloads folder or file manager.' 
        });
        return;
      } catch (downloadError) {
        console.log('Download fallback failed:', downloadError);
      }

      // PRIORITY 4: Final fallback - Show error message
      toast({
        variant: 'destructive',
        title: 'Share failed',
        description: 'Unable to share document. Please try downloading the file manually and then share it.',
      });
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