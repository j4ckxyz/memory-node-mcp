FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Create directory for database volume
RUN mkdir -p /root/.memory-node

CMD ["npm", "start"]
