import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';

export const useNotebooks = () => {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: notebooks = [],
    isLoading,
    error,
    isError,
  } = useQuery({
    queryKey: ['notebooks', user?.id],
    queryFn: async () => {
      if (!user) {
        console.log('No hay usuario, devolviendo array de cuadernos vacío');
        return [];
      }
      
      console.log('Obteniendo cuadernos para usuario:', user.id);
      
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/notebooks`);
      return response.data;
    },
    enabled: isAuthenticated && !authLoading,
    retry: (failureCount, error) => {
      // No reintentar en errores de autenticación
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        return false;
      }
      return failureCount < 3;
    },
  });

  const createNotebook = useMutation({
    mutationFn: async (notebookData: { title: string; description?: string }) => {
      console.log('Creando cuaderno con datos:', notebookData);
      
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/notebooks`, notebookData);
      return response.data;
    },
    onSuccess: (data) => {
      console.log('Mutación exitosa, invalidando consultas');
      queryClient.invalidateQueries({ queryKey: ['notebooks', user?.id] });
    },
    onError: (error) => {
      console.error('Error de mutación:', error);
    },
  });

  return {
    notebooks,
    isLoading: authLoading || isLoading,
    error: error?.message || null,
    isError,
    createNotebook: createNotebook.mutate,
    isCreating: createNotebook.isPending,
  };
};