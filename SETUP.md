# LLM Web Scraper Setup Guide

Simple setup instructions for the LLM Web Scraper application.

## Prerequisites

1. **Python 3.8+** - Download from [python.org](https://www.python.org/downloads/)
2. **Node.js 18+** - Download from [nodejs.org](https://nodejs.org/)
3. **Docker Desktop** - Download from [docker.com](https://www.docker.com/products/docker-desktop/)
4. **OpenAI API Key** - Get from [openai.com](https://openai.com/)

## Setup Steps

**1. Environment Setup**
```bash
cp env.example .env
# Edit .env and add: OPENAI_API_KEY=your_key_here
```

**2. Start Database**
```bash
docker-compose up -d
```

**3. Install Backend Dependencies**
```bash
cd backend
pip install -r requirements.txt
playwright install chromium
```

**4. Install Frontend Dependencies**
```bash
cd frontend
npm install
```

**5. Start Backend** (Terminal 1)
```bash
cd backend
python main.py
```

**6. Start Frontend** (Terminal 2)
```bash
cd frontend
npm run dev
```

## Access URLs
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs
- pgAdmin: http://localhost:5050 (admin@llmscraper.com / admin123)

## Troubleshooting

**Installation Issues:**
- If `pip install` fails, try: `pip install --upgrade pip` first
- If Playwright fails: `playwright install chromium --force`
- If Docker fails: Make sure Docker Desktop is running

**Runtime Issues:**
- Database not ready: Wait 30 seconds after `docker-compose up -d`
- Port conflicts: Make sure ports 3000, 8000, 5432 are free
- OpenAI errors: Check your API key in `.env` file

That's it! Your LLM Web Scraper is ready to use at http://localhost:3000
