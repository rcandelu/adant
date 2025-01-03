# Usa un'immagine Node.js ufficiale come base
FROM node:18

# Imposta la directory di lavoro all'interno del container
WORKDIR /usr/src/app

# Copia il file package.json e package-lock.json
COPY package*.json ./

# Installa le dipendenze
RUN npm install

# Copia tutto il codice sorgente nella directory di lavoro
COPY . .

# Esponi la porta sulla quale il server ascolterà
EXPOSE 3026

# Comando per avviare l'app
CMD ["node", "sentinel2.js"]