FROM node:18-alpine

WORKDIR /app

# Instalar dependencias del sistema
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    ffmpeg

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias usando npm ci para una instalación más robusta
RUN npm ci

# Copiar código fuente
COPY . .

# Crear directorios necesarios
RUN mkdir -p uploads audio logs

# Exponer puerto
EXPOSE 3001

# Comando de inicio
CMD ["npm", "start"]