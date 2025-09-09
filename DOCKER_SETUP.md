# Docker Setup Guide for LLM Generator

This guide explains how to run the LLM Generator application using Docker with custom ports.

## Port Configuration

The application uses the following custom ports:

- **Frontend**: `8020` (React app with nginx)
- **Backend**: `3020` (FastAPI application)
- **PostgreSQL**: `7543` (unusual port for database)
- **pgAdmin**: `9876` (unusual port for database management)
- **Redis**: `4321` (unusual port for caching/job queue)

## Prerequisites

- Docker Desktop installed and running
- Docker Compose v2.x
- At least 4GB of RAM available for containers

## Environment Setup

1. Create a `.env` file in the project root:
```bash
OPENAI_API_KEY=your_openai_api_key_here
```

## Starting the Application

1. **Build and start all services**:
```bash
docker-compose up --build
```

2. **Start in detached mode** (background):
```bash
docker-compose up -d --build
```

3. **View logs**:
```bash
docker-compose logs -f
```

## Accessing the Application

Once all containers are running:

- **Frontend**: http://localhost:8020 ✅ (React development server)
- **Backend API**: http://localhost:3020 ✅ (FastAPI with auto-reload)
- **Backend Docs**: http://localhost:3020/docs ✅ (Swagger UI)
- **pgAdmin**: http://localhost:9876 ✅ (Database management)
  - Email: admin@llmscraper.com
  - Password: admin123
- **PostgreSQL**: localhost:7543 ✅ (Database server)
  - User: llm_scraper_user
  - Password: your_secure_password
  - Database: llm_scraper_db
- **Redis**: localhost:4321 ✅ (Cache/Job queue)

All services are now running successfully! 🎉

## Development vs Production

### Development Mode
- Run `npm run dev` in the frontend directory for hot reloading
- Backend runs with volume mounts for live code changes
- Use ports 3000 (frontend dev server) and 3020 (backend)

### Production Mode (Docker)
- Frontend is built and served by nginx
- Optimized production builds
- All services containerized
- Use ports 8020 (frontend) and 3020 (backend)

## Useful Commands

### Container Management
```bash
# Stop all services
docker-compose down

# Remove containers and volumes
docker-compose down -v

# Rebuild specific service
docker-compose build frontend
docker-compose build backend

# View running containers
docker ps

# Access container shell
docker exec -it llm_scraper_frontend sh
docker exec -it llm_scraper_backend bash
```

### Database Management
```bash
# Connect to PostgreSQL
docker exec -it llm_scraper_db psql -U llm_scraper_user -d llm_scraper_db

# Backup database
docker exec llm_scraper_db pg_dump -U llm_scraper_user llm_scraper_db > backup.sql

# Restore database
docker exec -i llm_scraper_db psql -U llm_scraper_user -d llm_scraper_db < backup.sql
```

### Troubleshooting

1. **Port conflicts**: Make sure ports 8020, 3020, 7543, 9876, and 4321 are not in use
2. **Build issues**: Clear Docker cache with `docker system prune -a`
3. **Database issues**: Remove volumes with `docker-compose down -v` and restart
4. **Frontend not loading**: Check nginx logs with `docker logs llm_scraper_frontend`
5. **Backend API issues**: Check backend logs with `docker logs llm_scraper_backend`

### Health Checks

- **Backend Health**: http://localhost:3020/health
- **Database**: Check connection in pgAdmin or via psql
- **Frontend**: Should load at http://localhost:8020

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   PostgreSQL    │
│   (nginx)       │◄──►│   (FastAPI)     │◄──►│   (Database)    │
│   Port: 8020    │    │   Port: 3020    │    │   Port: 7543    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │              ┌─────────────────┐
         │                       │              │    pgAdmin      │
         │                       │              │   Port: 9876    │
         │                       │              └─────────────────┘
         │                       │
         │              ┌─────────────────┐
         │              │     Redis       │
         │              │   Port: 4321    │
         │              └─────────────────┘
         │
    ┌─────────────────┐
    │   User Browser  │
    │   Port: 8020    │
    └─────────────────┘
```

## Notes

- The frontend uses nginx as a reverse proxy to handle API and WebSocket requests
- All inter-container communication happens through the internal Docker network
- Volume mounts are used for development to enable hot reloading
- The application supports both HTTP and WebSocket connections
- Static assets are served with proper caching headers
