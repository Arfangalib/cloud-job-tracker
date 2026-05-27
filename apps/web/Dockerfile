FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
COPY apps/web/package*.json apps/web/
RUN npm install --workspace apps/web
COPY apps/web apps/web
WORKDIR /app/apps/web
EXPOSE 5173
CMD ["npm", "run", "dev"]
