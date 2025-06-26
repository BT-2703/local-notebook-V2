import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';

export interface Note {
  id: string;
  notebook_id: string;
  title: string;
  content: string;
  source_type: 'user' | 'ai_response';
  extracted_text?: string;
  created_at: string;
  updated_at: string;
}

export const useNotes = (notebookId?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notes, isLoading } = useQuery({
    queryKey: ['notes', notebookId],
    queryFn: async () => {
      if (!notebookId) return [];
      
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/notes/notebook/${notebookId}`);
        return response.data as Note[];
      } catch (error) {
        console.error('Error fetching notes:', error);
        throw error;
      }
    },
    enabled: !!notebookId && !!user,
  });

  const createNoteMutation = useMutation({
    mutationFn: async ({ 
      title, 
      content, 
      source_type = 'user',
      extracted_text 
    }: { 
      title: string; 
      content: string; 
      source_type?: 'user' | 'ai_response';
      extracted_text?: string;
    }) => {
      if (!notebookId) throw new Error('Notebook ID is required');
      
      try {
        const response = await axios.post(`${import.meta.env.VITE_API_URL}/notes`, {
          notebook_id: notebookId,
          title,
          content,
          source_type,
          extracted_text,
        });
        
        return response.data;
      } catch (error) {
        console.error('Error creating note:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', notebookId] });
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: async ({ id, title, content }: { id: string; title: string; content: string }) => {
      try {
        const response = await axios.put(`${import.meta.env.VITE_API_URL}/notes/${id}`, {
          title,
          content,
          updated_at: new Date().toISOString()
        });
        
        return response.data;
      } catch (error) {
        console.error('Error updating note:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', notebookId] });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (id: string) => {
      try {
        await axios.delete(`${import.meta.env.VITE_API_URL}/notes/${id}`);
        return id;
      } catch (error) {
        console.error('Error deleting note:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', notebookId] });
    },
  });

  return {
    notes,
    isLoading,
    createNote: createNoteMutation.mutate,
    isCreating: createNoteMutation.isPending,
    updateNote: updateNoteMutation.mutate,
    isUpdating: updateNoteMutation.isPending,
    deleteNote: deleteNoteMutation.mutate,
    isDeleting: deleteNoteMutation.isPending,
  };
};