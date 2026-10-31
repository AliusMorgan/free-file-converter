FROM node:20-slim

ENV HOME=/tmp

RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-writer \
    libreoffice-impress \
    fontconfig \
    fonts-noto-core \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    fonts-liberation \
    fonts-dejavu \
    && rm -rf /var/lib/apt/lists/* \
    && fc-cache -f

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 10000
CMD ["npm", "start"]
