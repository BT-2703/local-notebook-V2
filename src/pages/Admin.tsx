import React, { useState } from 'react';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2, Plus, RefreshCw, Save, X, Check, Settings, Users, BarChart3, Database } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Logo from '@/components/ui/Logo';

// Tipos
interface LLMConfig {
  id: string;
  name: string;
  provider: string;
  model: string;
  api_key?: string;
  base_url?: string;
  is_active: boolean;
  is_default: boolean;
  config?: any;
  created_at: string;
  updated_at: string;
}

interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
}

interface SystemStats {
  totalUsers: number;
  totalNotebooks: number;
  totalSources: number;
  totalDocuments: number;
  sourceTypes: Array<{type: string, count: string}>;
  activeUsers: Array<{id: string, email: string, full_name: string, notebook_count: string}>;
}

const Admin = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  // Estado para el formulario de configuración LLM
  const [editingConfig, setEditingConfig] = useState<LLMConfig | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  
  // Consultas
  const { data: llmConfigs, isLoading: isLoadingConfigs } = useQuery({
    queryKey: ['llm-configs'],
    queryFn: async () => {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/admin/llm-configs`);
      return response.data as LLMConfig[];
    }
  });
  
  const { data: ollamaModels, isLoading: isLoadingOllama, refetch: refetchOllamaModels } = useQuery({
    queryKey: ['ollama-models'],
    queryFn: async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/admin/ollama-models`);
        return response.data as OllamaModel[];
      } catch (error) {
        console.error('Error al obtener modelos de Ollama:', error);
        return [];
      }
    }
  });
  
  const { data: systemStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['system-stats'],
    queryFn: async () => {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/admin/stats`);
      return response.data as SystemStats;
    }
  });
  
  // Mutaciones
  const createLLMConfig = useMutation({
    mutationFn: async (config: Omit<LLMConfig, 'id' | 'created_at' | 'updated_at'>) => {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/admin/llm-configs`, config);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['llm-configs'] });
      toast({
        title: "Configuración creada",
        description: "La configuración del modelo ha sido creada exitosamente.",
      });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Error al crear la configuración",
        variant: "destructive",
      });
    }
  });
  
  const updateLLMConfig = useMutation({
    mutationFn: async (config: Partial<LLMConfig> & { id: string }) => {
      const response = await axios.put(`${import.meta.env.VITE_API_URL}/admin/llm-configs/${config.id}`, config);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['llm-configs'] });
      toast({
        title: "Configuración actualizada",
        description: "La configuración del modelo ha sido actualizada exitosamente.",
      });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Error al actualizar la configuración",
        variant: "destructive",
      });
    }
  });
  
  const deleteLLMConfig = useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`${import.meta.env.VITE_API_URL}/admin/llm-configs/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['llm-configs'] });
      toast({
        title: "Configuración eliminada",
        description: "La configuración del modelo ha sido eliminada exitosamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Error al eliminar la configuración",
        variant: "destructive",
      });
    }
  });
  
  // Funciones auxiliares
  const resetForm = () => {
    setEditingConfig(null);
    setIsCreating(false);
    setShowApiKey(false);
  };
  
  const handleEditConfig = (config: LLMConfig) => {
    setEditingConfig({...config});
    setIsCreating(false);
  };
  
  const handleCreateConfig = () => {
    setEditingConfig({
      id: '',
      name: '',
      provider: 'ollama',
      model: '',
      api_key: '',
      base_url: '',
      is_active: true,
      is_default: false,
      created_at: '',
      updated_at: ''
    });
    setIsCreating(true);
    setShowApiKey(true);
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingConfig) return;
    
    if (isCreating) {
      createLLMConfig.mutate(editingConfig);
    } else {
      updateLLMConfig.mutate(editingConfig);
    }
  };
  
  const handleDelete = (id: string) => {
    deleteLLMConfig.mutate(id);
  };
  
  // Renderizado
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Logo />
            <div>
              <h1 className="text-xl font-medium text-gray-900">Panel de Administración</h1>
              <p className="text-sm text-gray-500">HorusLM</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate('/')}>
            Volver al Dashboard
          </Button>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-6 py-8">
        <Tabs defaultValue="llm">
          <div className="mb-6">
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="llm" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <span>Modelos LLM</span>
              </TabsTrigger>
              <TabsTrigger value="stats" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                <span>Estadísticas</span>
              </TabsTrigger>
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>Usuarios</span>
              </TabsTrigger>
            </TabsList>
          </div>
          
          {/* Pestaña de configuración de LLM */}
          <TabsContent value="llm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1">
                <Card>
                  <CardHeader>
                    <CardTitle>Modelos configurados</CardTitle>
                    <CardDescription>
                      Gestiona los modelos de lenguaje disponibles en el sistema
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoadingConfigs ? (
                      <div className="flex justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {llmConfigs?.map(config => (
                          <div 
                            key={config.id} 
                            className={`p-3 rounded-md border cursor-pointer hover:bg-gray-50 ${config.is_default ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                            onClick={() => handleEditConfig(config)}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="font-medium">{config.name}</h3>
                                <p className="text-sm text-gray-500">{config.provider} / {config.model}</p>
                              </div>
                              <div className="flex items-center space-x-2">
                                {config.is_default && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    <Check className="h-3 w-3 mr-1" />
                                    Predeterminado
                                  </span>
                                )}
                                {config.is_active ? (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    Activo
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                    Inactivo
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        {(!llmConfigs || llmConfigs.length === 0) && (
                          <div className="text-center py-4 text-gray-500">
                            No hay configuraciones disponibles
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                  <CardFooter>
                    <Button 
                      onClick={handleCreateConfig} 
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Añadir modelo
                    </Button>
                  </CardFooter>
                </Card>
                
                {/* Modelos de Ollama */}
                <Card className="mt-6">
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle>Modelos de Ollama</CardTitle>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => refetchOllamaModels()}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                    <CardDescription>
                      Modelos disponibles en tu instancia local de Ollama
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoadingOllama ? (
                      <div className="flex justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {ollamaModels?.map(model => (
                          <div 
                            key={model.name} 
                            className="p-3 rounded-md border border-gray-200"
                          >
                            <h3 className="font-medium">{model.name}</h3>
                            <p className="text-sm text-gray-500">
                              {(model.size / (1024 * 1024 * 1024)).toFixed(2)} GB
                            </p>
                          </div>
                        ))}
                        
                        {(!ollamaModels || ollamaModels.length === 0) && (
                          <div className="text-center py-4 text-gray-500">
                            No se encontraron modelos de Ollama
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
              
              {/* Formulario de edición/creación */}
              <div className="md:col-span-2">
                {editingConfig && (
                  <Card>
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <CardTitle>
                          {isCreating ? 'Añadir modelo' : 'Editar modelo'}
                        </CardTitle>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={resetForm}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <CardDescription>
                        {isCreating 
                          ? 'Configura un nuevo modelo de lenguaje' 
                          : 'Modifica la configuración del modelo seleccionado'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form id="llm-config-form" onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="name">Nombre</Label>
                            <Input 
                              id="name" 
                              value={editingConfig.name} 
                              onChange={e => setEditingConfig({...editingConfig, name: e.target.value})}
                              required
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="provider">Proveedor</Label>
                            <Select 
                              value={editingConfig.provider}
                              onValueChange={value => setEditingConfig({...editingConfig, provider: value})}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar proveedor" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ollama">Ollama (Local)</SelectItem>
                                <SelectItem value="openai">OpenAI</SelectItem>
                                <SelectItem value="anthropic">Anthropic</SelectItem>
                                <SelectItem value="gemini">Google Gemini</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="model">Modelo</Label>
                          {editingConfig.provider === 'ollama' && ollamaModels && ollamaModels.length > 0 ? (
                            <Select 
                              value={editingConfig.model}
                              onValueChange={value => setEditingConfig({...editingConfig, model: value})}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar modelo" />
                              </SelectTrigger>
                              <SelectContent>
                                {ollamaModels.map(model => (
                                  <SelectItem key={model.name} value={model.name}>
                                    {model.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input 
                              id="model" 
                              value={editingConfig.model} 
                              onChange={e => setEditingConfig({...editingConfig, model: e.target.value})}
                              required
                              placeholder={
                                editingConfig.provider === 'openai' ? 'gpt-4' :
                                editingConfig.provider === 'anthropic' ? 'claude-3-sonnet-20240229' :
                                editingConfig.provider === 'gemini' ? 'gemini-pro' :
                                'Nombre del modelo'
                              }
                            />
                          )}
                        </div>
                        
                        {editingConfig.provider !== 'ollama' && (
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <Label htmlFor="api_key">Clave API</Label>
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setShowApiKey(!showApiKey)}
                              >
                                {showApiKey ? 'Ocultar' : 'Mostrar'}
                              </Button>
                            </div>
                            <Input 
                              id="api_key" 
                              type={showApiKey ? 'text' : 'password'} 
                              value={editingConfig.api_key || ''} 
                              onChange={e => setEditingConfig({...editingConfig, api_key: e.target.value})}
                              required={isCreating}
                              placeholder={isCreating ? 'Ingresa tu clave API' : 'Dejar en blanco para mantener la actual'}
                            />
                          </div>
                        )}
                        
                        <div className="space-y-2">
                          <Label htmlFor="base_url">URL Base (opcional)</Label>
                          <Input 
                            id="base_url" 
                            value={editingConfig.base_url || ''} 
                            onChange={e => setEditingConfig({...editingConfig, base_url: e.target.value})}
                            placeholder={
                              editingConfig.provider === 'ollama' ? 'http://localhost:11434' :
                              editingConfig.provider === 'openai' ? 'https://api.openai.com/v1' :
                              'URL base del API (opcional)'
                            }
                          />
                        </div>
                        
                        <Separator />
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Switch 
                              id="is_active"
                              checked={editingConfig.is_active}
                              onCheckedChange={checked => setEditingConfig({...editingConfig, is_active: checked})}
                            />
                            <Label htmlFor="is_active">Activo</Label>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <Switch 
                              id="is_default"
                              checked={editingConfig.is_default}
                              onCheckedChange={checked => setEditingConfig({...editingConfig, is_default: checked})}
                            />
                            <Label htmlFor="is_default">Predeterminado</Label>
                          </div>
                        </div>
                      </form>
                    </CardContent>
                    <CardFooter className="flex justify-between">
                      {!isCreating && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Eliminar
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción no se puede deshacer. Se eliminará permanentemente la configuración del modelo.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleDelete(editingConfig.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                      
                      <div className="flex space-x-2 ml-auto">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={resetForm}
                        >
                          Cancelar
                        </Button>
                        <Button 
                          type="submit" 
                          form="llm-config-form"
                          disabled={createLLMConfig.isPending || updateLLMConfig.isPending}
                        >
                          <Save className="h-4 w-4 mr-2" />
                          {createLLMConfig.isPending || updateLLMConfig.isPending ? 'Guardando...' : 'Guardar'}
                        </Button>
                      </div>
                    </CardFooter>
                  </Card>
                )}
                
                {!editingConfig && (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center p-8">
                      <Database className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Gestión de modelos</h3>
                      <p className="text-gray-500 mb-4">
                        Selecciona un modelo para editar o haz clic en "Añadir modelo" para crear uno nuevo.
                      </p>
                      <Button onClick={handleCreateConfig}>
                        <Plus className="h-4 w-4 mr-2" />
                        Añadir modelo
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
          
          {/* Pestaña de estadísticas */}
          <TabsContent value="stats">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Estadísticas generales */}
              <div className="md:col-span-3">
                <Card>
                  <CardHeader>
                    <CardTitle>Estadísticas del sistema</CardTitle>
                    <CardDescription>
                      Información general sobre el uso de la plataforma
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoadingStats ? (
                      <div className="flex justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                          <h3 className="text-sm font-medium text-gray-500">Usuarios</h3>
                          <p className="text-3xl font-bold">{systemStats?.totalUsers || 0}</p>
                        </div>
                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                          <h3 className="text-sm font-medium text-gray-500">Cuadernos</h3>
                          <p className="text-3xl font-bold">{systemStats?.totalNotebooks || 0}</p>
                        </div>
                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                          <h3 className="text-sm font-medium text-gray-500">Fuentes</h3>
                          <p className="text-3xl font-bold">{systemStats?.totalSources || 0}</p>
                        </div>
                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                          <h3 className="text-sm font-medium text-gray-500">Documentos vectoriales</h3>
                          <p className="text-3xl font-bold">{systemStats?.totalDocuments || 0}</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
              
              {/* Distribución de tipos de fuentes */}
              <div className="md:col-span-1">
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle>Tipos de fuentes</CardTitle>
                    <CardDescription>
                      Distribución por tipo de fuente
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoadingStats ? (
                      <div className="flex justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {systemStats?.sourceTypes?.map(item => (
                          <div key={item.type} className="flex justify-between items-center">
                            <div className="flex items-center">
                              <div className={`w-3 h-3 rounded-full mr-2 ${
                                item.type === 'pdf' ? 'bg-red-500' :
                                item.type === 'text' ? 'bg-blue-500' :
                                item.type === 'website' ? 'bg-green-500' :
                                item.type === 'youtube' ? 'bg-purple-500' :
                                item.type === 'audio' ? 'bg-yellow-500' :
                                'bg-gray-500'
                              }`}></div>
                              <span className="capitalize">{item.type}</span>
                            </div>
                            <span className="font-medium">{item.count}</span>
                          </div>
                        ))}
                        
                        {(!systemStats?.sourceTypes || systemStats.sourceTypes.length === 0) && (
                          <div className="text-center py-4 text-gray-500">
                            No hay datos disponibles
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
              
              {/* Usuarios más activos */}
              <div className="md:col-span-2">
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle>Usuarios más activos</CardTitle>
                    <CardDescription>
                      Usuarios con mayor número de cuadernos
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoadingStats ? (
                      <div className="flex justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {systemStats?.activeUsers?.map(user => (
                          <div key={user.id} className="flex justify-between items-center p-3 rounded-md border border-gray-200">
                            <div>
                              <h3 className="font-medium">{user.full_name || 'Usuario sin nombre'}</h3>
                              <p className="text-sm text-gray-500">{user.email}</p>
                            </div>
                            <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm font-medium">
                              {user.notebook_count} cuadernos
                            </div>
                          </div>
                        ))}
                        
                        {(!systemStats?.activeUsers || systemStats.activeUsers.length === 0) && (
                          <div className="text-center py-4 text-gray-500">
                            No hay datos disponibles
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
          
          {/* Pestaña de usuarios */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>Gestión de usuarios</CardTitle>
                <CardDescription>
                  Ver y gestionar usuarios del sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-gray-500">
                    La gestión completa de usuarios estará disponible en una próxima actualización.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;