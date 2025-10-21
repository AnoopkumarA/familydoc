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
      
      // Try to download the file for native sharing
      const { data: blob, error: dlError } = await supabase.storage
        .from('documents')
        .download(document.file_path);

      if (dlError) throw dlError;

      const file = new File([blob], document.name, { type: document.file_type });
      const nav: any = navigator as any;

      console.log('File details:', {
        name: file.name,
        type: file.type,
        size: file.size,
        lastModified: file.lastModified
      });

      // Ensure proper MIME type for better sharing compatibility
      let shareableFile = file;
      if (!file.type || file.type === 'application/octet-stream') {
        // Try to determine MIME type from file extension
        const extension = file.name.split('.').pop()?.toLowerCase();
        const mimeTypes: Record<string, string> = {
          'pdf': 'application/pdf',
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
          'doc': 'application/msword',
          'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'txt': 'text/plain',
          'zip': 'application/zip'
        };
        
        if (extension && mimeTypes[extension]) {
          shareableFile = new File([blob], file.name, { type: mimeTypes[extension] });
          console.log('Updated MIME type:', shareableFile.type);
        }
      }

      // Enhanced mobile detection and native sharing
      if (canShareURL()) {
        // First try: Share file directly (best for mobile)
        if (canShareFiles()) {
          try {
            // Test if we can share this specific file
            const canShareThisFile = nav.canShare({ files: [shareableFile] });
            console.log('Can share this file:', canShareThisFile);
            
            if (canShareThisFile) {
              await nav.share({ 
                files: [shareableFile], 
                title: document.name, 
                text: document.description || 'Shared from Family Document Vault' 
              });
              toast({ title: 'File shared', description: 'Document file shared successfully via native share.' });
              return;
            } else {
              console.log('Cannot share this file type, trying URL fallback');
            }
          } catch (shareError) {
            console.log('Direct file sharing failed, trying URL fallback:', shareError);
          }
        }

        // Second try: Share URL (fallback for mobile when file sharing fails)
        try {
          const { data: linkData, error } = await supabase.storage
            .from('documents')
            .createSignedUrl(document.file_path, 60 * 60 * 24); // 24 hours
          if (error) throw error;
          
          await nav.share({ 
            title: document.name, 
            text: document.description || 'Document from Family Document Vault', 
            url: linkData.signedUrl 
          });
          toast({ title: 'Link shared', description: 'Document link shared via native share.' });
          return;
        } catch (urlShareError) {
          console.log('URL sharing failed, trying Android intent fallback:', urlShareError);
        }
      }

      // For Android, try alternative sharing methods
      if (isAndroidDevice && isMobile) {
        try {
          // Check if we're in a WebView
          if (isWebView()) {
            // Method 1: Try Android Intent URL with file data
            try {
              // Convert file to base64 for Android intent
              const reader = new FileReader();
              reader.onload = () => {
                const base64 = reader.result as string;
                const dataUrl = `data:${shareableFile.type};base64,${base64.split(',')[1]}`;
                
                // Try to share file via Android intent
                const intentUrl = `intent://share#Intent;action=android.intent.action.SEND;type=${shareableFile.type};S.android.intent.extra.STREAM=${encodeURIComponent(dataUrl)};S.android.intent.extra.TEXT=${encodeURIComponent(document.name)};end`;
                window.location.href = intentUrl;
                toast({ title: 'Opening share', description: 'Opening Android share panel with file...' });
              };
              reader.readAsDataURL(shareableFile);
              return;
            } catch (intentError) {
              console.log('File intent failed, trying URL intent:', intentError);
            }

            // Method 2: Try Android Intent URL with download link
            try {
              const { data: linkData, error } = await supabase.storage
                .from('documents')
                .createSignedUrl(document.file_path, 60 * 60 * 24);
              if (error) throw error;

              const intentUrl = `intent://share#Intent;action=android.intent.action.SEND;type=${shareableFile.type};S.android.intent.extra.TEXT=${encodeURIComponent(`${document.name}\n\nDownload: ${linkData.signedUrl}`)};end`;
              window.location.href = intentUrl;
              toast({ title: 'Opening share', description: 'Opening Android share panel...' });
              return;
            } catch (urlIntentError) {
              console.log('URL intent failed:', urlIntentError);
            }

            // Method 3: Try creating a temporary link element
            try {
              const { data: linkData, error } = await supabase.storage
                .from('documents')
                .createSignedUrl(document.file_path, 60 * 60 * 24);
              if (error) throw error;

              const tempLink = document.createElement('a');
              tempLink.href = `mailto:?subject=${encodeURIComponent(document.name)}&body=${encodeURIComponent(`Document: ${document.name}\n\nDownload link: ${linkData.signedUrl}`)}`;
              tempLink.click();
              toast({ title: 'Opening email', description: 'Opening email app to share document...' });
              return;
            } catch (emailError) {
              console.log('Email sharing failed:', emailError);
            }

            // Method 4: Try WhatsApp Web API
            try {
              const { data: linkData, error } = await supabase.storage
                .from('documents')
                .createSignedUrl(document.file_path, 60 * 60 * 24);
              if (error) throw error;

              const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${document.name}\n\nDownload: ${linkData.signedUrl}`)}`;
              window.open(whatsappUrl, '_blank');
              toast({ title: 'Opening WhatsApp', description: 'Opening WhatsApp to share document...' });
              return;
            } catch (whatsappError) {
              console.log('WhatsApp sharing failed:', whatsappError);
            }
          }
        } catch (androidError) {
          console.log('Android sharing methods failed:', androidError);
        }
      }

      // Final fallback: Copy link to clipboard
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