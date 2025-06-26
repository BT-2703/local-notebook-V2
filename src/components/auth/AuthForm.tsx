import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const AuthForm = () => {
  // Estado para el formulario de inicio de sesión
  const [loginEmail, setLoginEmail] = useState('admin@horuslm.local');
  const [loginPassword, setLoginPassword] = useState('admin123');
  const [loginLoading, setLoginLoading] = useState(false);
  
  // Estado para el formulario de registro
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [registerFullName, setRegisterFullName] = useState('');
  const [registerLoading, setRegisterLoading] = useState(false);
  
  const { toast } = useToast();
  const navigate = useNavigate();
  const { login, register, isAuthenticated } = useAuth();

  // Redirigir si ya está autenticado
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Manejar inicio de sesión
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);

    try {
      await login(loginEmail, loginPassword);
      
      toast({
        title: "¡Bienvenido de nuevo!",
        description: "Has iniciado sesión correctamente.",
      });
      
      navigate('/', { replace: true });
    } catch (error: any) {
      console.error('Error de inicio de sesión:', error);
      
      toast({
        title: "Error de inicio de sesión",
        description: error.response?.data?.error || "Credenciales inválidas. Por favor, verifica tu email y contraseña.",
        variant: "destructive",
      });
    } finally {
      setLoginLoading(false);
    }
  };

  // Manejar registro
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar contraseñas
    if (registerPassword !== registerConfirmPassword) {
      toast({
        title: "Error de registro",
        description: "Las contraseñas no coinciden.",
        variant: "destructive",
      });
      return;
    }
    
    setRegisterLoading(true);

    try {
      await register(registerEmail, registerPassword, registerFullName);
      
      toast({
        title: "¡Registro exitoso!",
        description: "Tu cuenta ha sido creada correctamente.",
      });
      
      navigate('/', { replace: true });
    } catch (error: any) {
      console.error('Error de registro:', error);
      
      toast({
        title: "Error de registro",
        description: error.response?.data?.error || "No se pudo crear la cuenta. Por favor, intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setRegisterLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <Tabs defaultValue="login">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Acceso</CardTitle>
            <TabsList>
              <TabsTrigger value="login">Iniciar sesión</TabsTrigger>
              <TabsTrigger value="register">Registrarse</TabsTrigger>
            </TabsList>
          </div>
          <CardDescription>
            Accede a tu cuenta para gestionar tus cuadernos
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  placeholder="Ingresa tu email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Contraseña</Label>
                <Input
                  id="login-password"
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  placeholder="Ingresa tu contraseña"
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loginLoading}>
                {loginLoading ? 'Iniciando sesión...' : 'Iniciar sesión'}
              </Button>
            </form>
          </TabsContent>
          
          <TabsContent value="register">
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="register-email">Email</Label>
                <Input
                  id="register-email"
                  type="email"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  required
                  placeholder="Ingresa tu email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-fullname">Nombre completo</Label>
                <Input
                  id="register-fullname"
                  type="text"
                  value={registerFullName}
                  onChange={(e) => setRegisterFullName(e.target.value)}
                  placeholder="Ingresa tu nombre completo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-password">Contraseña</Label>
                <Input
                  id="register-password"
                  type="password"
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  required
                  placeholder="Crea una contraseña"
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-confirm-password">Confirmar contraseña</Label>
                <Input
                  id="register-confirm-password"
                  type="password"
                  value={registerConfirmPassword}
                  onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                  required
                  placeholder="Confirma tu contraseña"
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={registerLoading}>
                {registerLoading ? 'Registrando...' : 'Registrarse'}
              </Button>
            </form>
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
};

export default AuthForm;