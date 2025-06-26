import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import axios from 'axios';

export const useNotebookUpdate = () => {
  const queryClient = useQueryClient();

  const updateNotebook = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: { title?: string; description?: string } }) => {
      console.log('Updating notebook:', id, updates);
      
      try {
        const response = await axios.put(`${import.meta.env.VITE_API_URL}/notebooks/${id}`, updates);
        return response.data;
      } catch (error) {
        console.error('Error updating notebook:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log('Mutation success, invalidating queries');
      queryClient.invalidateQueries({ queryKey: ['notebook', data.id] });
      queryClient.invalidateQueries({ queryKey: ['notebooks'] });
    },
    onError: (error) => {
      console.error('Mutation error:', error);
    },
  });

  return {
    updateNotebook: updateNotebook.mutate,
    isUpdating: updateNotebook.isPending,
  };
};