# Interactive LLM Web Scraper Application

An AI-powered web application that replicates the functionality of the [LLM Scraper library](https://github.com/mishushakov/llm-scraper) - analyzing webpages, generating custom Playwright extraction scripts, and saving structured data to a database through a user-friendly interface.

## 🌟 Features

### Core Functionality
- **AI-Powered Analysis**: Uses OpenAI to analyze webpage structure and generate extraction scripts
- **Manual JSON Schema Editor**: NEW! Direct JSON editing with real-time validation and dual-mode interface
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
- **🆕 Dual-Mode Schema Editor**: Switch between Visual Builder and Manual JSON Editor
- **🆕 Real-time JSON Validation**: Live syntax checking and schema validation
- **🆕 Professional JSON Editor**: Syntax highlighting, error indicators, and line counting
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
- **Containerization**: Docker with Docker Compose for easy deployment

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Node.js 18+
- Docker Desktop
- OpenAI API Key

### Docker Setup (Recommended)

1. **Clone the repository**
```bash
git clone https://github.com/abdullah0sadiku/llm-scraper-website.git
cd llm-scraper-website
```

2. **Create environment file**
```bash
cp env.example .env
```
Edit `.env` and add your OpenAI API key:
```
OPENAI_API_KEY=your_openai_api_key_here
```

3. **Start all services with Docker**
```bash
docker-compose up --build
```

### Access Points
- **Frontend**: http://localhost:8020 🎯
- **Backend API**: http://localhost:3020 🔧
- **API Docs**: http://localhost:3020/docs 📚
- **pgAdmin**: http://localhost:9876 🗄️ (admin@llmscraper.com / admin123)

### Manual Setup (Alternative)

1. **Start Database**
```bash
docker-compose up -d postgres pgadmin
```

2. **Install Backend Dependencies**
```bash
cd backend
pip install -r requirements.txt
playwright install chromium
```

3. **Install Frontend Dependencies**
```bash
cd frontend
npm install
```

4. **Start Backend** (in one terminal)
```bash
cd backend
python main.py
```

5. **Start Frontend** (in another terminal)
```bash
cd frontend
npm run dev
```

## 📖 Usage Guide

### Creating Your First Scraping Job

1. **Navigate to "New Job"** from the dashboard
2. **Enter Target URL** (e.g., https://news.ycombinator.com)
3. **Define Schema** using either:
   - **Visual Builder**: Drag-and-drop interface
   - **🆕 Manual JSON Editor**: Direct JSON editing with validation
4. **Create Job** - AI generates and executes Playwright script
5. **Monitor Progress** with real-time WebSocket updates
6. **View Results** and export as JSON/CSV

### 🆕 Manual JSON Schema Editor

The new manual editor allows power users to:
- **Edit JSON directly** with syntax highlighting
- **Real-time validation** with error indicators
- **Switch modes** between Visual and JSON editing
- **Copy-paste schemas** from external sources
- **Professional editor experience** with line counting and formatting

#### Example: E-commerce Product Schema
```json
{
  "type": "array",
  "items": {
    "product_name": {
      "type": "string",
      "required": true,
      "description": "Product name"
    },
    "price": {
      "type": "string", 
      "required": true,
      "description": "Product price with currency"
    },
    "image_url": {
      "type": "string",
      "required": false,
      "description": "Product image URL"
    },
    "availability": {
      "type": "string",
      "required": false,
      "description": "Stock status"
    }
  }
}
```

### Example Schemas

**News Articles:**
```json
{
  "type": "array",
  "items": {
    "title": {"type": "string", "required": true},
    "content": {"type": "string", "required": false},
    "author": {"type": "string", "required": false},
    "date": {"type": "string", "required": false},
    "url": {"type": "string", "required": false}
  }
}
```

**Contact Information:**
```json
{
  "type": "object",
  "properties": {
    "company_name": {"type": "string", "required": true},
    "address": {"type": "string", "required": false},
    "phone": {"type": "string", "required": false},
    "email": {"type": "string", "required": false}
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
- **Job Creator**: URL input and dual-mode schema builder
- **Job Manager**: List and manage all jobs
- **Results Viewer**: Display and export extracted data
- **Script Viewer**: Generated Playwright scripts with syntax highlighting

### Database Schema
```sql
-- Core tables for job management
scraping_jobs       -- Job metadata and status
generated_scripts   -- AI-generated Playwright scripts
extracted_data      -- Scraped results
script_templates    -- Reusable extraction patterns
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
├── docker-compose.yml     # Docker services
├── DOCKER_SETUP.md       # Docker documentation
├── MANUAL_SCHEMA_EDITOR.md # Manual editor guide
└── SETUP.md              # Detailed setup guide
```

### Key Features Implementation

**🆕 Manual JSON Editor:**
- Real-time JSON validation with Zod schemas
- Bidirectional synchronization between visual and JSON modes
- Professional editor experience with syntax highlighting
- Error handling and user-friendly validation messages

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
- **Port conflicts**: Ensure ports 8020, 3020, 7543, 9876, and 4321 are available
- **CORS errors**: The latest version includes comprehensive CORS configuration

### Debug Information
- Backend logs: Check terminal output or `scraper.log`
- Frontend logs: Browser console (F12)
- Database logs: pgAdmin or `docker-compose logs postgres`

## 📚 Documentation

- **Docker Setup Guide**: [DOCKER_SETUP.md](DOCKER_SETUP.md) - Complete Docker deployment guide
- **Manual Editor Guide**: [MANUAL_SCHEMA_EDITOR.md](MANUAL_SCHEMA_EDITOR.md) - Comprehensive manual editor documentation
- **Setup Guide**: [SETUP.md](SETUP.md) - Detailed installation instructions
- **API Documentation**: http://localhost:3020/docs (when running)
- **Database Schema**: See `database/init.sql`

## 🆕 What's New

### Version 2.0 Features
- **Manual JSON Schema Editor** with real-time validation
- **Dual-mode interface** (Visual + JSON editing)
- **Docker deployment** with custom ports
- **Enhanced CORS support** for cross-origin requests
- **Professional editor experience** with syntax highlighting
- **Improved error handling** and user feedback

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

**Ready to start scraping?** 🚀

1. Clone this repository
2. Follow the Docker setup instructions
3. Visit http://localhost:8020
4. Try the new manual JSON editor feature!

**Need help?** Check out our comprehensive documentation or open an issue!