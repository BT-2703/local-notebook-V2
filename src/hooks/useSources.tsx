import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNotebookGeneration } from './useNotebookGeneration';
import { useEffect } from 'react';
import axios from 'axios';

export const useSources = (notebookId?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { generateNotebookContentAsync } = useNotebookGeneration();

  const {
    data: sources = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['sources', notebookId],
    queryFn: async () => {
      if (!notebookId) return [];
      
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/sources/notebook/${notebookId}`);
        return response.data;
      } catch (error) {
        console.error('Error fetching sources:', error);
        throw error;
      }
    },
    enabled: !!notebookId,
  });

  // Set up polling for sources table
  useEffect(() => {
    if (!notebookId || !user) return;

    console.log('Setting up polling for sources table, notebook:', notebookId);

    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['sources', notebookId] });
    }, 5000);

    return () => {
      console.log('Cleaning up polling for sources');
      clearInterval(interval);
    };
  }, [notebookId, user, queryClient]);

  const addSource = useMutation({
    mutationFn: async (sourceData: {
      notebookId: string;
      title: string;
      type: 'pdf' | 'text' | 'website' | 'youtube' | 'audio';
      content?: string;
      url?: string;
      file_path?: string;
      file_size?: number;
      processing_status?: string;
      metadata?: any;
    }) => {
      if (!user) throw new Error('User not authenticated');

      try {
        const response = await axios.post(`${import.meta.env.VITE_API_URL}/sources`, {
          notebook_id: sourceData.notebookId,
          title: sourceData.title,
          type: sourceData.type,
          content: sourceData.content,
          url: sourceData.url,
          file_path: sourceData.file_path,
          file_size: sourceData.file_size,
          processing_status: sourceData.processing_status,
          metadata: sourceData.metadata || {},
        });

        return response.data;
      } catch (error) {
        console.error('Error adding source:', error);
        throw error;
      }
    },
    onSuccess: async (newSource) => {
      console.log('Source added successfully:', newSource);
      
      // Invalidate sources query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['sources', newSource.notebook_id] });
      
      // Check for first source to trigger generation
      const currentSources = queryClient.getQueryData(['sources', newSource.notebook_id]) as any[] || [];
      const isFirstSource = currentSources.length === 0;
      
      if (isFirstSource && newSource.notebook_id) {
        console.log('This is the first source, checking notebook generation status...');
        
        try {
          // Check notebook generation status
          const response = await axios.get(`${import.meta.env.VITE_API_URL}/notebooks/${newSource.notebook_id}`);
          const notebook = response.data;
          
          if (notebook?.generation_status === 'pending') {
            console.log('Triggering notebook content generation...');
            
            // Determine if we can trigger generation based on source type and available data
            const canGenerate = 
              (newSource.type === 'pdf' && newSource.file_path) ||
              (newSource.type === 'text' && newSource.content) ||
              (newSource.type === 'website' && newSource.url) ||
              (newSource.type === 'youtube' && newSource.url) ||
              (newSource.type === 'audio' && newSource.file_path);
            
            if (canGenerate) {
              try {
                await generateNotebookContentAsync({
                  notebookId: newSource.notebook_id,
                  filePath: newSource.file_path || newSource.url,
                  sourceType: newSource.type
                });
              } catch (error) {
                console.error('Failed to generate notebook content:', error);
              }
            } else {
              console.log('Source not ready for generation yet - missing required data');
            }
          }
        } catch (error) {
          console.error('Error checking notebook status:', error);
        }
      }
    },
  });

  const updateSource = useMutation({
    mutationFn: async ({ sourceId, updates }: { 
      sourceId: string; 
      updates: { 
        title?: string;
        file_path?: string;
        processing_status?: string;
      }
    }) => {
      try {
        const response = await axios.put(`${import.meta.env.VITE_API_URL}/sources/${sourceId}`, updates);
        return response.data;
      } catch (error) {
        console.error('Error updating source:', error);
        throw error;
      }
    },
    onSuccess: async (updatedSource) => {
      // Invalidate sources query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['sources', updatedSource.notebook_id] });
      
      // If file_path was added and this is the first source, trigger generation
      if (updatedSource.file_path && updatedSource.notebook_id) {
        try {
          const sourcesResponse = await axios.get(`${import.meta.env.VITE_API_URL}/sources/notebook/${updatedSource.notebook_id}`);
          const currentSources = sourcesResponse.data || [];
          const isFirstSource = currentSources.length === 1;
          
          if (isFirstSource) {
            const notebookResponse = await axios.get(`${import.meta.env.VITE_API_URL}/notebooks/${updatedSource.notebook_id}`);
            const notebook = notebookResponse.data;
            
            if (notebook?.generation_status === 'pending') {
              console.log('File path updated, triggering notebook content generation...');
              
              try {
                await generateNotebookContentAsync({
                  notebookId: updatedSource.notebook_id,
                  filePath: updatedSource.file_path,
                  sourceType: updatedSource.type
                });
              } catch (error) {
                console.error('Failed to generate notebook content:', error);
              }
            }
          }
        } catch (error) {
          console.error('Error checking sources or notebook status:', error);
        }
      }
    },
  });

  return {
    sources,
    isLoading,
    error,
    addSource: addSource.mutate,
    addSourceAsync: addSource.mutateAsync,
    isAdding: addSource.isPending,
    updateSource: updateSource.mutate,
    isUpdating: updateSource.isPending,
  };
};