import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import axios from 'axios';

export const useSourceUpdate = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  const updateSource = useMutation({
    mutationFn: async ({ sourceId, title }: { sourceId: string; title: string }) => {
      console.log('Updating source:', sourceId, 'with title:', title);
      
      try {
        const response = await axios.put(`${import.meta.env.VITE_API_URL}/sources/${sourceId}`, { title });
        return response.data;
      } catch (error) {
        console.error('Error updating source:', error);
        throw error;
      }
    },
    onSuccess: (updatedSource) => {
      console.log('Update mutation success, invalidating queries');
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      toast({
        title: "Source renamed",
        description: "The source has been successfully renamed.",
      });
    },
    onError: (error) => {
      console.error('Update mutation error:', error);
      toast({
        title: "Error",
        description: "Failed to rename the source. Please try again.",
        variant: "destructive",
      });
    },
  });

  return {
    updateSource: updateSource.mutate,
    isUpdating: updateSource.isPending,
  };
};