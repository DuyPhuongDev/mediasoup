
FROM node:20

# Thiết lập thư mục làm việc trong container
WORKDIR /app

# Copy file package.json và package-lock.json vào container
COPY package*.json ./

# Cài đặt dependencies
RUN npm install

# Copy toàn bộ source code vào container
COPY . .

# Mở cổng 3030
EXPOSE 3030

# Mở dải port cho UDP
EXPOSE 40000-41000/udp

# Chạy ứng dụng khi container khởi động
CMD ["node", "server.js"]
