# Use an official Node.js runtime as a parent image
FROM node:18

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

COPY ./sockets.sql /docker-entrypoint-initdb.d/

# Copy SSL certificates
COPY ./ssl /etc/nginx/ssl

# Set permissions for SSL certificates
RUN chmod 644 /etc/nginx/ssl/www_brightspace_health.crt \
    && chmod 644 /etc/nginx/ssl/www_brightspace_health.key

# Make port 8080 available to the world outside this container
EXPOSE 3001

# Define the command to run the application
CMD ["npm", "start"]