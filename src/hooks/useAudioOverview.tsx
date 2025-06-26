import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import axios from 'axios';

export const useAudioOverview = (notebookId?: string) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string | null>(null);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Set up polling for notebook updates
  useEffect(() => {
    if (!notebookId) return;

    const interval = setInterval(async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/notebooks/${notebookId}`);
        const notebook = response.data;
        
        if (notebook?.audio_overview_generation_status) {
          setGenerationStatus(notebook.audio_overview_generation_status);
          
          if (notebook.audio_overview_generation_status === 'completed' && notebook.audio_overview_url) {
            setIsGenerating(false);
            toast({
              title: "Audio Overview Ready!",
              description: "Your deep dive conversation is ready to play!",
            });
            
            // Invalidate queries to refresh the UI
            queryClient.invalidateQueries({ queryKey: ['notebooks'] });
          } else if (notebook.audio_overview_generation_status === 'failed') {
            setIsGenerating(false);
            toast({
              title: "Generation Failed",
              description: "Failed to generate audio overview. Please try again.",
              variant: "destructive",
            });
          }
        }
      } catch (error) {
        console.error('Error polling notebook status:', error);
      }
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [notebookId, toast, queryClient]);

  const generateAudioOverview = useMutation({
    mutationFn: async (notebookId: string) => {
      setIsGenerating(true);
      setGenerationStatus('generating');
      
      try {
        const response = await axios.post(`${import.meta.env.VITE_API_URL}/audio/generate/${notebookId}`);
        return response.data;
      } catch (error) {
        console.error('Error starting audio generation:', error);
        throw error;
      }
    },
    onSuccess: (data, notebookId) => {
      console.log('Audio generation started successfully:', data);
    },
    onError: (error) => {
      console.error('Audio generation failed to start:', error);
      setIsGenerating(false);
      setGenerationStatus(null);
      
      toast({
        title: "Failed to Start Generation",
        description: error.message || "Failed to start audio generation. Please try again.",
        variant: "destructive",
      });
    }
  });

  const refreshAudioUrl = useMutation({
    mutationFn: async ({ notebookId, silent = false }: { notebookId: string; silent?: boolean }) => {
      if (!silent) {
        setIsAutoRefreshing(true);
      }

      try {
        const response = await axios.post(`${import.meta.env.VITE_API_URL}/audio/refresh/${notebookId}`);
        return response.data;
      } catch (error) {
        console.error('Error refreshing audio URL:', error);
        throw error;
      }
    },
    onSuccess: (data, variables) => {
      console.log('Audio URL refreshed successfully:', data);
      // Invalidate queries to refresh the UI with new URL
      queryClient.invalidateQueries({ queryKey: ['notebooks'] });
      
      if (!variables.silent) {
        setIsAutoRefreshing(false);
      }
    },
    onError: (error, variables) => {
      console.error('Failed to refresh audio URL:', error);
      if (!variables.silent) {
        setIsAutoRefreshing(false);
        toast({
          title: "Failed to Refresh URL",
          description: "Unable to refresh the audio URL. Please try again.",
          variant: "destructive",
        });
      }
    }
  });

  const checkAudioExpiry = (expiresAt: string | null): boolean => {
    if (!expiresAt) return true;
    return new Date(expiresAt) <= new Date();
  };

  const autoRefreshIfExpired = async (notebookId: string, expiresAt: string | null) => {
    if (checkAudioExpiry(expiresAt) && !isAutoRefreshing && !refreshAudioUrl.isPending) {
      console.log('Audio URL expired, auto-refreshing...');
      try {
        await refreshAudioUrl.mutateAsync({ notebookId, silent: true });
      } catch (error) {
        console.error('Auto-refresh failed:', error);
      }
    }
  };

  return {
    generateAudioOverview: generateAudioOverview.mutate,
    refreshAudioUrl: (notebookId: string) => refreshAudioUrl.mutate({ notebookId }),
    autoRefreshIfExpired,
    isGenerating: isGenerating || generateAudioOverview.isPending,
    isAutoRefreshing,
    generationStatus,
    checkAudioExpiry,
  };
};