FROM node:10-alpine
LABEL com.centurylinklabs.watchtower.enable="true"
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci
COPY src ./src
CMD ["npm", "start"]