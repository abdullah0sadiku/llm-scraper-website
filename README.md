# Interactive LLM Web Scraper Application

An AI-powered web application that replicates the functionality of the [LLM Scraper library](https://github.com/mishushakov/llm-scraper) - analyzing webpages, generating custom Playwright extraction scripts, and saving structured data to a database through a user-friendly interface.

## 🌟 Features

### Core Functionality
- **AI-Powered Analysis**: Uses OpenAI to analyze webpage structure and generate extraction scripts
- **Custom Schema Builder**: Intuitive drag-and-drop interface for defining data structure
- **Real-time Scraping**: WebSocket-based progress updates and live job monitoring
- **Script Generation**: Automatic Playwright script generation based on webpage analysis
- **Data Management**: PostgreSQL database for storing jobs, scripts, and results

### User Interface
- **Modern React Frontend**: Built with TypeScript, Tailwind CSS, and Vite
- **Dashboard**: Overview of all scraping jobs with statistics and quick actions
- **Job Management**: Create, monitor, cancel, and delete scraping jobs
- **Results Viewer**: Display extracted data in tables with export options
- **Script Viewer**: View and copy generated Playwright scripts
- **Template System**: Pre-built templates for common scraping patterns

### Advanced Features
- **Schema Suggestions**: AI automatically suggests optimal data schemas
- **URL Validation**: Pre-flight checks to ensure target websites are accessible
- **Export Options**: Download results as JSON or CSV
- **Error Handling**: Comprehensive error handling and retry mechanisms
- **Job History**: Track and manage historical scraping jobs

## 🏗️ Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Python FastAPI + SQLAlchemy + Asyncio
- **Database**: PostgreSQL with pgAdmin for management
- **AI Integration**: OpenAI GPT-4 for webpage analysis and script generation
- **Web Scraping**: Playwright (Python) for reliable browser automation
- **Real-time Updates**: WebSocket connections for live progress tracking

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Node.js 18+
- Docker Desktop
- OpenAI API Key

### Setup Instructions

1. **Create environment file**
   ```bash
   cp env.example .env
   ```
   Edit `.env` and add your OpenAI API key:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

2. **Start Database**
   ```bash
   docker-compose up -d
   ```

3. **Install Backend Dependencies**
   ```bash
   cd backend
   pip install -r requirements.txt
   playwright install chromium
   ```

4. **Install Frontend Dependencies**
   ```bash
   cd frontend
   npm install
   ```

5. **Start Backend** (in one terminal)
   ```bash
   cd backend
   python main.py
   ```

6. **Start Frontend** (in another terminal)
   ```bash
   cd frontend
   npm run dev
   ```

### Access Points
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **pgAdmin**: http://localhost:5050 (admin@llmscraper.com / admin123)

## 📖 Usage Guide

### Creating Your First Scraping Job

1. **Navigate to "New Job"** from the dashboard
2. **Enter Target URL** (e.g., https://news.ycombinator.com)
3. **Define Schema** using the visual builder:
   - Choose Array (multiple items) or Object (single item)
   - Add fields you want to extract
   - Use AI suggestions for optimal schemas
4. **Create Job** - AI generates and executes Playwright script
5. **Monitor Progress** with real-time WebSocket updates
6. **View Results** and export as JSON/CSV

### Example Schemas

**News Articles:**
```json
{
  "type": "array",
  "items": {
    "title": "string",
    "content": "string", 
    "author": "string",
    "date": "string",
    "url": "string"
  }
}
```

**Product Listings:**
```json
{
  "type": "array",
  "items": {
    "name": "string",
    "price": "string",
    "description": "string",
    "image": "string",
    "rating": "string"
  }
}
```

## 🏛️ Architecture

### Backend Services
- **FastAPI Server**: RESTful API with automatic OpenAPI documentation
- **AI Service**: OpenAI integration for webpage analysis and script generation
- **Playwright Service**: Browser automation and script execution
- **Database Service**: PostgreSQL with SQLAlchemy ORM
- **WebSocket Service**: Real-time job progress updates

### Frontend Components
- **Dashboard**: Job overview and statistics
- **Job Creator**: URL input and schema builder
- **Job Manager**: List and manage all jobs
- **Results Viewer**: Display and export extracted data
- **Script Viewer**: Generated Playwright scripts with syntax highlighting

### Database Schema
```sql
-- Core tables for job management
scraping_jobs        -- Job metadata and status
generated_scripts    -- AI-generated Playwright scripts  
extracted_data       -- Scraped results
script_templates     -- Reusable extraction patterns
```

## 🔧 Development

### Project Structure
```
LLM_generator/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── models/         # SQLAlchemy models
│   │   ├── services/       # Business logic
│   │   ├── api/           # API endpoints
│   │   └── core/          # Configuration
│   ├── requirements.txt
│   └── main.py
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Route components
│   │   ├── services/      # API integration
│   │   ├── types/         # TypeScript definitions
│   │   └── utils/         # Helper functions
│   ├── package.json
│   └── vite.config.ts
├── database/              # Database setup
│   └── init.sql          # Schema initialization
├── docker-compose.yml     # Development environment
├── start.py              # Automated startup script
└── SETUP.md              # Detailed setup guide
```

### Key Features Implementation

**AI Integration:**
- OpenAI GPT-4 for HTML analysis and script generation
- Function calling for structured data extraction
- Prompt engineering for reliable Playwright code generation

**Real-time Updates:**
- WebSocket connections for live job progress
- React Query for efficient data fetching and caching
- Background task processing with asyncio

**Data Management:**
- PostgreSQL with UUID primary keys
- JSONB columns for flexible schema storage
- Automatic cleanup and cascading deletes

## 🐛 Troubleshooting

### Common Issues
- **Docker not running**: Ensure Docker Desktop is installed and running
- **OpenAI API errors**: Check your API key in the `.env` file
- **Database connection**: Wait 30-60 seconds for PostgreSQL to fully start
- **Port conflicts**: Ensure ports 3000, 8000, and 5432 are available

### Debug Information
- Backend logs: Check terminal output or `scraper.log`
- Frontend logs: Browser console (F12)
- Database logs: pgAdmin or `docker-compose logs postgres`

## 📚 Documentation

- **Setup Guide**: [SETUP.md](SETUP.md) - Detailed installation instructions
- **API Documentation**: http://localhost:8000/docs (when running)
- **Database Schema**: See `database/init.sql`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- Inspired by the [LLM Scraper library](https://github.com/mishushakov/llm-scraper) by mishushakov
- Built with modern web technologies and AI capabilities
- Designed for both technical and non-technical users

---

**Ready to start scraping?** Follow the setup instructions above and visit http://localhost:3000!
#   l l m - s c r a p e r - w e b s i t e  
 