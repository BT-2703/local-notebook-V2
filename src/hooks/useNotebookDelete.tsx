import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export const useNotebookDelete = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  const deleteNotebook = useMutation({
    mutationFn: async (notebookId: string) => {
      console.log('Iniciando proceso de eliminación de cuaderno para:', notebookId);
      
      const response = await axios.delete(`${import.meta.env.VITE_API_URL}/notebooks/${notebookId}`);
      return response.data;
    },
    onSuccess: (data, notebookId) => {
      console.log('Eliminación exitosa, invalidando consultas');
      
      // Invalidar todas las consultas relacionadas
      queryClient.invalidateQueries({ queryKey: ['notebooks', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['sources', notebookId] });
      queryClient.invalidateQueries({ queryKey: ['notebook', notebookId] });
      
      toast({
        title: "Cuaderno eliminado",
        description: "El cuaderno y todas sus fuentes han sido eliminados exitosamente.",
      });
    },
    onError: (error: any) => {
      console.error('Error de eliminación:', error);
      
      let errorMessage = "Error al eliminar el cuaderno. Por favor, intenta de nuevo.";
      
      // Proporcionar mensajes de error más específicos según el tipo de error
      if (error?.response?.status === 404) {
        errorMessage = "Cuaderno no encontrado o no tienes permiso para eliminarlo.";
      } else if (error?.response?.status === 403) {
        errorMessage = "No tienes permiso para eliminar este cuaderno.";
      } else if (error?.message?.includes('network')) {
        errorMessage = "Error de red. Por favor, verifica tu conexión e intenta de nuevo.";
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  return {
    deleteNotebook: deleteNotebook.mutate,
    isDeleting: deleteNotebook.isPending,
  };
};