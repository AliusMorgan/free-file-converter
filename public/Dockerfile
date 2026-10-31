FROM node:18-alpine

WORKDIR /usr/src/app

# نسخ ملف الاعتماديات من داخل مجلد public الحالي
COPY public/package*.json ./

RUN npm install --production

# نسخ كافة الملفات من داخل مجلد public إلى مسار العمل
COPY public/ ./

EXPOSE 10000

CMD ["npm", "start"]
