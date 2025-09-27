FROM node:20-alpine AS base

# Устанавливаем рабочую директорию
WORKDIR /app

# Устанавливаем зависимости
COPY package.json pnpm-lock.yaml* ./
# Используем npm, так как он уже установлен в образе
RUN npm install

# Копируем исходный код
COPY . .

# Собираем приложение
RUN npm run build

# Production образ
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production

# Копируем билд и файлы зависимостей
COPY --from=base /app/public ./public
COPY --from=base /app/.next ./.next
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./package.json
COPY --from=base /app/next.config.mjs ./

# Открываем порт 3000
EXPOSE 3000

# Запускаем приложение
CMD ["npm", "start"] 