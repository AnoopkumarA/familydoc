import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { isMobileDevice, canShareFiles, canShareURL, isAndroid, isWebView, debugShareCapabilities } from '@/lib/utils';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

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
      // Check if we're running in a Capacitor app
      const isCapacitor = Capacitor.isNativePlatform();
      
      if (isCapacitor) {
        // For Capacitor apps, download and save file locally, then share
        try {
          toast({ title: 'Preparing file...', description: 'Downloading document for sharing...' });
          
          // Download the file from Supabase
          const { data: blob, error: dlError } = await supabase.storage
            .from('documents')
            .download(document.file_path);

          if (dlError) throw dlError;

          // Convert blob to base64
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve, reject) => {
            reader.onload = () => {
              const result = reader.result as string;
              // Remove data URL prefix to get just base64
              const base64 = result.split(',')[1];
              resolve(base64);
            };
            reader.onerror = reject;
          });
          
          reader.readAsDataURL(blob);
          const base64Data = await base64Promise;

          // Determine file extension and MIME type
          const fileExtension = document.name.split('.').pop()?.toLowerCase() || 'bin';
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
          
          const mimeType = mimeTypes[fileExtension] || 'application/octet-stream';
          
          // Save file to device storage
          const fileName = `shared_${Date.now()}_${document.name}`;
          const filePath = `shared_documents/${fileName}`;
          
          await Filesystem.writeFile({
            path: filePath,
            data: base64Data,
            directory: Directory.Cache,
            encoding: Encoding.UTF8
          });

          // Get the file URI for sharing
          const fileUri = await Filesystem.getUri({
            directory: Directory.Cache,
            path: filePath
          });

          // Use native Android sharing with file URI
          await Share.share({
            title: document.name,
            text: document.description || 'Shared from Family Document Vault',
            url: fileUri.uri,
            dialogTitle: 'Share Document'
          });
          
          toast({ title: 'Document shared', description: 'Document file shared successfully!' });
          return;
        } catch (capError) {
          console.log('Capacitor file sharing failed, trying URL fallback:', capError);
          
          // Fallback to URL sharing if file sharing fails
          try {
            const { data: linkData, error } = await supabase.storage
              .from('documents')
              .createSignedUrl(document.file_path, 60 * 60 * 24);
            if (error) throw error;

            await Share.share({
              title: document.name,
              text: document.description || 'Shared from Family Document Vault',
              url: linkData.signedUrl,
              dialogTitle: 'Share Document'
            });
            
            toast({ title: 'Link shared', description: 'Document link shared successfully.' });
            return;
          } catch (urlError) {
            console.log('URL sharing also failed:', urlError);
          }
        }
      }

      // For web browsers, use Web Share API with file
      const isMobile = isMobileDevice();
      
      // Download the file for sharing
      const { data: blob, error: dlError } = await supabase.storage
        .from('documents')
        .download(document.file_path);

      if (dlError) throw dlError;

      const file = new File([blob], document.name, { type: document.file_type });
      const nav: any = navigator as any;

      // Try Web Share API with file
      if (canShareURL() && canShareFiles()) {
        try {
          if (nav.canShare({ files: [file] })) {
            await nav.share({ 
              files: [file], 
              title: document.name, 
              text: document.description || 'Shared from Family Document Vault' 
            });
            toast({ title: 'File shared', description: 'Document file shared successfully!' });
            return;
          }
        } catch (shareError) {
          console.log('Web Share API file sharing failed:', shareError);
        }
      }

      // Fallback to URL sharing for web
      try {
        const { data: linkData, error } = await supabase.storage
          .from('documents')
          .createSignedUrl(document.file_path, 60 * 60 * 24);
        if (error) throw error;
        
        if (canShareURL()) {
          await nav.share({ 
            title: document.name, 
            text: document.description || 'Document from Family Document Vault', 
            url: linkData.signedUrl 
          });
          toast({ title: 'Link shared', description: 'Document link shared successfully.' });
          return;
        }
      } catch (urlShareError) {
        console.log('URL sharing failed:', urlShareError);
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