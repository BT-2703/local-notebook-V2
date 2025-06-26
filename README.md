<p align="center">
  <img src="public/logo.png" alt="HorusLM Logo" width="200"/>
</p>

# HorusLM: Asistente de Conocimiento con IA

[![Licencia: MIT](https://img.shields.io/badge/Licencia-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> ¿Qué pasaría si el poder de una herramienta como NotebookLM no estuviera encerrado en un sistema cerrado? ¿Qué pasaría si pudieras construir una alternativa privada y auto-alojada que se puede personalizar para las necesidades de tu empresa, todo sin escribir una sola línea de código?

Eso es exactamente lo que hemos hecho con **HorusLM**. Este proyecto es una alternativa de código abierto y auto-alojable a NotebookLM. Está diseñado para ser una potente herramienta de investigación con IA que fundamenta sus respuestas exclusivamente en las fuentes que proporcionas, convirtiéndola en una ventana confiable al conocimiento de tu empresa.

## Acerca del Proyecto

HorusLM es una aplicación robusta con características potentes, desarrollada para funcionar completamente en local:

* **Soporte para múltiples LLMs:** Usa OpenAI, Anthropic, Google Gemini o modelos locales de Ollama.
* **Base de datos vectorial local:** Almacena y busca en tus documentos con pgvector.
* **Interfaz de administración:** Configura modelos y gestiona usuarios desde un panel de control.
* **Completamente en español:** Interfaz y funcionalidades totalmente en español.
* **Despliegue con Docker:** Instalación sencilla con Docker Compose.

## Características Principales

* **Chatea con tus Documentos:** Sube tus documentos y obtén respuestas instantáneas y contextualizadas.
* **Citas Verificables:** Salta directamente a la fuente de la información para asegurar que la IA no está inventando.
* **Generación de Podcast:** Crea resúmenes y discusiones en audio a partir de tus materiales fuente.
* **Privado y Auto-alojado:** Mantén control completo sobre tus datos alojándolo tú mismo. Usa modelos locales si lo deseas.
* **Personalizable y Extensible:** Construido con herramientas modernas y accesibles, facilitando su adaptación a tus necesidades específicas.

## Construido Con

Este proyecto está construido con una pila moderna y potente:
* **Frontend:** 
    * [Vite](https://vitejs.dev/)
    * [React](https://react.dev/)
    * [TypeScript](https://www.typescriptlang.org/)
    * [shadcn-ui](https://ui.shadcn.com/)
    * [Tailwind CSS](https://tailwindcss.com/)
* **Backend:**
    * [Node.js](https://nodejs.org/)
    * [Express](https://expressjs.com/)
    * [PostgreSQL](https://www.postgresql.org/) con [pgvector](https://github.com/pgvector/pgvector)
    * [Redis](https://redis.io/)
* **Modelos de IA:**
    * [Ollama](https://ollama.ai/) para modelos locales
    * Soporte para OpenAI, Anthropic y Google Gemini

## Primeros Pasos

### Instalación con Docker Compose

La forma más sencilla de comenzar con HorusLM es usar Docker Compose:

```bash
# Clonar el repositorio
git clone https://github.com/tuusuario/horuslm.git
cd horuslm

# Copiar el archivo de variables de entorno
cp .env.example .env

# Iniciar los servicios
docker-compose up -d

# Acceder a la aplicación
# Frontend: http://localhost:3000
# Panel de administración: http://localhost:3000/admin
```

### Instalación para desarrollo

Si prefieres ejecutar la aplicación en modo desarrollo:

```bash
# Clonar el repositorio
git clone https://github.com/tuusuario/horuslm.git
cd horuslm

# Copiar el archivo de variables de entorno
cp .env.example .env

# Instalar dependencias del frontend
npm install

# Instalar dependencias del backend
cd backend
npm install
cd ..

# Iniciar la base de datos y Ollama con Docker
docker-compose up -d postgres redis ollama

# Iniciar el backend en modo desarrollo
cd backend
npm run dev
cd ..

# Iniciar el frontend en modo desarrollo
npm run dev
```

### Credenciales por defecto

```
Email: admin@horuslm.local
Contraseña: admin123
```

## Configuración de Modelos

HorusLM soporta múltiples proveedores de modelos de lenguaje:

1. **Ollama (Local):** Modelos ejecutados localmente sin necesidad de API externa.
2. **OpenAI:** Modelos como GPT-4 y GPT-3.5.
3. **Anthropic:** Modelos Claude.
4. **Google Gemini:** Modelos Gemini Pro.

Para configurar los modelos, accede al panel de administración en `/admin` y navega a la sección "Modelos LLM".

## Contribuir

Las contribuciones hacen que la comunidad de código abierto sea un lugar increíble para aprender, inspirar y crear. Cualquier contribución que hagas será muy apreciada.

- Haz un fork del proyecto
- Crea tu rama de características (`git checkout -b feature/CaracteristicaIncreible`)
- Haz commit de tus cambios (`git commit -m 'Añadir alguna CaracteristicaIncreible'`)
- Haz push a la rama (`git push origin feature/CaracteristicaIncreible`)
- Abre un Pull Request

## Licencia

Este código se distribuye bajo la Licencia MIT.