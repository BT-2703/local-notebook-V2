// Este archivo ha sido modificado para utilizar axios en lugar de supabase-js
import axios from 'axios';

// Configuración de axios para la API
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para añadir el token de autenticación
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Exportar el cliente para uso en la aplicación
export { apiClient };

// Para mantener compatibilidad con el código existente
export const supabase = {
  auth: {
    signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
      try {
        const response = await apiClient.post('/auth/login', { email, password });
        return { data: response.data, error: null };
      } catch (error: any) {
        return { data: null, error: error.response?.data || error };
      }
    },
    signOut: async () => {
      localStorage.removeItem('token');
      return { error: null };
    },
    getSession: async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        return { data: { session: null }, error: null };
      }
      
      try {
        const response = await apiClient.get('/auth/me');
        return { 
          data: { 
            session: { 
              user: response.data,
              access_token: token
            } 
          }, 
          error: null 
        };
      } catch (error: any) {
        return { data: { session: null }, error: error.response?.data || error };
      }
    },
    onAuthStateChange: (callback: Function) => {
      // Simulación simplificada del evento de cambio de autenticación
      const token = localStorage.getItem('token');
      if (token) {
        setTimeout(() => {
          callback('SIGNED_IN', { user: { email: 'usuario@ejemplo.com' } });
        }, 0);
      }
      
      return {
        data: {
          subscription: {
            unsubscribe: () => {}
          }
        }
      };
    }
  },
  from: () => {
    return {
      select: () => {
        return {
          eq: async () => {
            return { data: [], error: null };
          }
        };
      },
      insert: () => {
        return {
          select: () => {
            return {
              single: async () => {
                return { data: {}, error: null };
              }
            };
          }
        };
      },
      update: () => {
        return {
          eq: () => {
            return {
              select: () => {
                return {
                  single: async () => {
                    return { data: {}, error: null };
                  }
                };
              }
            };
          }
        };
      },
      delete: () => {
        return {
          eq: async () => {
            return { error: null };
          }
        };
      }
    };
  },
  storage: {
    from: () => {
      return {
        upload: async () => {
          return { data: {}, error: null };
        },
        getPublicUrl: () => {
          return { data: { publicUrl: '' } };
        },
        remove: async () => {
          return { error: null };
        },
        list: async () => {
          return { data: [], error: null };
        },
        createSignedUrl: async () => {
          return { data: { signedUrl: '' }, error: null };
        }
      };
    }
  },
  functions: {
    invoke: async (functionName: string, { body }: { body: any }) => {
      try {
        const response = await apiClient.post(`/functions/${functionName}`, body);
        return { data: response.data, error: null };
      } catch (error: any) {
        return { data: null, error: error.response?.data || error };
      }
    }
  },
  channel: (name: string) => {
    return {
      on: () => {
        return {
          subscribe: (callback?: (status: string) => void) => {
            if (callback) callback('SUBSCRIBED');
            return {};
          }
        };
      }
    };
  },
  removeChannel: () => {}
};

export default apiClient;