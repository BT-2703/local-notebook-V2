import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import axios from 'axios';

export const useSourceDelete = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  const deleteSource = useMutation({
    mutationFn: async (sourceId: string) => {
      console.log('Starting source deletion process for:', sourceId);
      
      try {
        // Delete the source through the API
        const response = await axios.delete(`${import.meta.env.VITE_API_URL}/sources/${sourceId}`);
        return response.data;
      } catch (error) {
        console.error('Error in source deletion process:', error);
        throw error;
      }
    },
    onSuccess: (deletedSource) => {
      console.log('Delete mutation success, invalidating queries');
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      toast({
        title: "Source deleted",
        description: `"${deletedSource?.title || 'Source'}" has been successfully deleted.`,
      });
    },
    onError: (error: any) => {
      console.error('Delete mutation error:', error);
      
      let errorMessage = "Failed to delete the source. Please try again.";
      
      // Provide more specific error messages based on the error type
      if (error?.code === 'PGRST116') {
        errorMessage = "Source not found or you don't have permission to delete it.";
      } else if (error?.message?.includes('foreign key')) {
        errorMessage = "Cannot delete source due to data dependencies. Please contact support.";
      } else if (error?.message?.includes('network')) {
        errorMessage = "Network error. Please check your connection and try again.";
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  return {
    deleteSource: deleteSource.mutate,
    isDeleting: deleteSource.isPending,
  };
};