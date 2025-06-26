import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import axios from 'axios';

export const useNotebookGeneration = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const generateNotebookContent = useMutation({
    mutationFn: async ({ notebookId, filePath, sourceType }: { 
      notebookId: string; 
      filePath?: string;
      sourceType: string;
    }) => {
      console.log('Starting notebook content generation for:', notebookId, 'with source type:', sourceType);
      
      try {
        const response = await axios.post(`${import.meta.env.VITE_API_URL}/notebooks/${notebookId}/generate`, {
          filePath,
          sourceType
        });
        
        return response.data;
      } catch (error) {
        console.error('Notebook generation error:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log('Notebook generation successful:', data);
      
      // Invalidate relevant queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['notebooks'] });
      queryClient.invalidateQueries({ queryKey: ['notebook'] });
      
      toast({
        title: "Content Generated",
        description: "Notebook title and description have been generated successfully.",
      });
    },
    onError: (error) => {
      console.error('Notebook generation failed:', error);
      
      toast({
        title: "Generation Failed",
        description: "Failed to generate notebook content. Please try again.",
        variant: "destructive",
      });
    },
  });

  return {
    generateNotebookContent: generateNotebookContent.mutate,
    generateNotebookContentAsync: generateNotebookContent.mutateAsync,
    isGenerating: generateNotebookContent.isPending,
  };
};