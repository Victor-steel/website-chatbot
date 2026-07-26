FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY . .
ENV NODE_ENV=production
ENV PORT=8788
EXPOSE 8788
CMD ["npm", "start"]
