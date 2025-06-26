import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import axios from 'axios';

export const useFileUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const uploadFile = async (file: File, notebookId: string, sourceId: string): Promise<string | null> => {
    try {
      setIsUploading(true);
      
      // Create FormData
      const formData = new FormData();
      formData.append('file', file);
      
      // Upload file to API
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/sources/upload/${notebookId}/${sourceId}`, 
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      
      if (response.status !== 200) {
        throw new Error('Upload failed');
      }
      
      console.log('File uploaded successfully:', response.data);
      return response.data.filePath;
    } catch (error) {
      console.error('File upload failed:', error);
      toast({
        title: "Upload Error",
        description: `Failed to upload ${file.name}. Please try again.`,
        variant: "destructive",
      });
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const getFileUrl = (filePath: string): string => {
    return `${import.meta.env.VITE_API_URL}/uploads/${filePath}`;
  };

  return {
    uploadFile,
    getFileUrl,
    isUploading,
  };
};