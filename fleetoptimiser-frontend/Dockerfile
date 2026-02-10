FROM node:25-alpine AS base

WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

EXPOSE 3000
CMD [ "npm", "run", "start" ]
