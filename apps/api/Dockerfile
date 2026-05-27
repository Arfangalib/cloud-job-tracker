FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
COPY apps/api/package*.json apps/api/
RUN npm install --workspace apps/api
COPY apps/api apps/api
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["npm", "start"]
