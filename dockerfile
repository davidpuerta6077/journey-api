FROM node:16-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY . .

RUN npm install --production

EXPOSE 3001

CMD [ "node", "api/index.js" ]