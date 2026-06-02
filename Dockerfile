# syntax=docker/dockerfile:1

# Node base with Bun installed (Expo's CLI needs a Node runtime; deps are managed by Bun)
FROM node:22-alpine AS base
WORKDIR /app
RUN npm install -g bun@1.3.5

# Install dependencies
FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Build the static web export
FROM base AS builder
ARG EXPO_PUBLIC_SUPABASE_URL
ARG EXPO_PUBLIC_SUPABASE_ANON_KEY
ARG EXPO_PUBLIC_API_URL
ARG EXPO_PUBLIC_COOKIE_DOMAIN

ENV EXPO_PUBLIC_SUPABASE_URL=$EXPO_PUBLIC_SUPABASE_URL
ENV EXPO_PUBLIC_SUPABASE_ANON_KEY=$EXPO_PUBLIC_SUPABASE_ANON_KEY
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL
ENV EXPO_PUBLIC_COOKIE_DOMAIN=$EXPO_PUBLIC_COOKIE_DOMAIN

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN bunx expo export --platform web

# Production image - serve static files
FROM node:22-alpine AS runner
WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]
