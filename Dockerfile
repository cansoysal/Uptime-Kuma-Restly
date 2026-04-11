FROM node:20-bookworm-slim

ENV NODE_ENV=production

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src
COPY README.md .env.example ./

EXPOSE 9911

CMD ["npm", "start"]
