FROM php:8.3-fpm
RUN apt-get update && apt-get install -y --no-install-recommends \
      libpng-dev libjpeg-dev libfreetype6-dev libzip-dev libonig-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) gd mysqli pdo_mysql mbstring zip \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /var/www/html
