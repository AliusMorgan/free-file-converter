FROM node:18-alpine

WORKDIR /app

# ننسخ ملفات الاعتماديات من داخل مجلد public
COPY public/package*.json ./

RUN npm install --production

# ننسخ باقي الملفات
COPY public/ .

EXPOSE 10000

CMD ["npm", "start"]
