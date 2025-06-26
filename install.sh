#!/bin/bash

# Colores para mensajes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # Sin Color

echo -e "${GREEN}=== Instalación de HorusLM ===${NC}"
echo "Este script configurará HorusLM en tu sistema."

# Verificar si Docker está instalado
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker no está instalado. Por favor, instala Docker y Docker Compose antes de continuar.${NC}"
    echo "Visita https://docs.docker.com/get-docker/ para instrucciones de instalación."
    exit 1
fi

# Verificar si Docker Compose está instalado
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Docker Compose no está instalado. Por favor, instala Docker Compose antes de continuar.${NC}"
    echo "Visita https://docs.docker.com/compose/install/ para instrucciones de instalación."
    exit 1
fi

# Crear directorios necesarios
echo -e "${YELLOW}Creando directorios necesarios...${NC}"
mkdir -p uploads audio logs nginx/ssl

# Crear archivo .env desde .env.example si no existe
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creando archivo .env desde .env.example...${NC}"
    cp .env.example .env
    echo -e "${GREEN}Archivo .env creado. Puedes editarlo para personalizar la configuración.${NC}"
else
    echo -e "${YELLOW}El archivo .env ya existe. Se mantendrá la configuración actual.${NC}"
fi

# Verificar si hay GPU disponible para Ollama
if command -v nvidia-smi &> /dev/null; then
    echo -e "${GREEN}GPU NVIDIA detectada. Ollama podrá utilizar aceleración GPU.${NC}"
else
    echo -e "${YELLOW}No se detectó GPU NVIDIA. Ollama funcionará solo con CPU.${NC}"
    # Modificar docker-compose.yml para quitar la configuración de GPU
    sed -i '/driver: nvidia/d' docker-compose.yml
    sed -i '/count: all/d' docker-compose.yml
    sed -i '/capabilities: \[gpu\]/d' docker-compose.yml
fi

# Iniciar los servicios
echo -e "${YELLOW}Iniciando servicios de HorusLM...${NC}"
docker-compose up -d

# Verificar si los servicios se iniciaron correctamente
if [ $? -eq 0 ]; then
    echo -e "${GREEN}¡HorusLM se ha instalado y configurado correctamente!${NC}"
    echo -e "${GREEN}Puedes acceder a la aplicación en: http://localhost:3000${NC}"
    echo -e "${GREEN}Panel de administración: http://localhost:3000/admin${NC}"
    echo -e "${YELLOW}Credenciales por defecto:${NC}"
    echo -e "Email: ${YELLOW}admin@horuslm.local${NC}"
    echo -e "Contraseña: ${YELLOW}admin123${NC}"
    echo -e "${RED}¡Importante! Cambia la contraseña por defecto después de iniciar sesión.${NC}"
else
    echo -e "${RED}Hubo un problema al iniciar los servicios. Revisa los logs con 'docker-compose logs'.${NC}"
fi