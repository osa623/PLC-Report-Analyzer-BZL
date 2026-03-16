# Use official Node.js image for frontend
FROM node:20 AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install
COPY frontend .
RUN npm run build

# Use official Python image for backend
FROM python:3.11 AS backend-build
WORKDIR /app/backend
COPY chat/requirements.md ./requirements.md
# If you have requirements.txt, use that instead
# COPY chat/requirements.txt ./requirements.txt
# RUN pip install -r requirements.txt

# Final image
FROM node:20-slim
WORKDIR /app
# Copy built frontend
COPY --from=frontend-build /app/frontend/.next ./.next
COPY --from=frontend-build /app/frontend/public ./public
COPY --from=frontend-build /app/frontend/package.json ./package.json
COPY --from=frontend-build /app/frontend/node_modules ./node_modules
COPY --from=frontend-build /app/frontend/next.config.ts ./next.config.ts
COPY --from=frontend-build /app/frontend/tsconfig.json ./tsconfig.json
COPY --from=frontend-build /app/frontend/src ./src
# Copy backend (adjust if you have Python code to run)
COPY --from=backend-build /app/backend ./chat

# Expose frontend port
EXPOSE 3000
# Expose backend port (if needed, e.g., 8000)
EXPOSE 8000

# Start frontend (adjust if you need to run backend too)
CMD ["npm", "start"]

