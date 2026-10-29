# 🌏 Tabi-Go AI — Multi-Agent Travel Planner

**An AI-powered travel planning assistant built with LangGraph, LangChain, FastAPI, and Groq.**

Tabi-Go AI transforms natural-language travel requests into organized travel plans by coordinating specialized AI agents for flight research, hotel discovery, itinerary creation, and final response generation.

## 📌 Problem Statement

Planning a trip often requires travelers to switch between multiple websites to research flights, compare accommodation options, discover attractions, and organize daily activities. This fragmented process can be time-consuming, difficult to manage, and inconvenient when travelers need to combine information from different sources into one practical itinerary.

**Tabi-Go AI addresses this problem by providing a unified, AI-powered travel planning workflow.** It uses a multi-agent architecture to research travel options, organize relevant information, generate a day-wise itinerary, and deliver a consolidated response based on the user's requirements.

The goal is to simplify trip planning through intelligent agent coordination, external search tools, and persistent conversation state.

## ✨ Key Features

- ✈️ **Flight Research:** Retrieves flight information using the AviationStack API and supports flight-related web searches.
- 🏨 **Hotel Discovery:** Researches accommodation options using Tavily Search.
- 🗺️ **Travel Research:** Discovers attractions, places to visit, and relevant travel information.
- 📅 **Day-Wise Itinerary:** Organizes activities and destinations into a structured travel plan.
- 🤖 **Multi-Agent Architecture:** Uses LangGraph to coordinate specialized agents through a shared state.
- 💬 **Natural-Language Interaction:** Accepts travel requests in conversational language.
- 🧠 **LLM-Powered Responses:** Uses Groq-hosted language models to generate travel recommendations and responses.
- 💾 **Conversation Persistence:** Uses PostgreSQL to store conversation history and relevant application state.
- 🌐 **Web Interface:** Provides a simple interface backed by FastAPI.

## 🏗️ System Architecture

The application uses four specialized agents coordinated through a LangGraph workflow.

### 1. Flight Agent ✈️

- Interprets the user's flight-related requirements.
- Searches for flight information using the AviationStack API.
- Uses Tavily Search for additional relevant travel information.
- Stores the results in the shared travel state.

### 2. Hotel Agent 🏨

- Researches accommodation options based on the user's destination and preferences.
- Uses Tavily Search to discover hotel information.
- Can incorporate Google Places API data when that integration is configured.
- Stores hotel research results in the shared state.

### 3. Itinerary Agent 🗺️

- Uses available trip details and research results to plan activities.
- Organizes places to visit into a day-wise itinerary.
- Can use search and mapping integrations for destination research and directions.
- Saves the generated itinerary in the shared state.

### 4. Final Response Agent 💬

- Collects relevant information produced by the other agents.
- Uses a Groq-hosted LLM to generate a consolidated response.
- Presents the travel research and itinerary in a readable format.

### Shared State and Memory

The agents exchange information through a shared `TravelState` managed by LangGraph. The state can contain:

- `user_query` — original travel request
- `flight_results` — flight research results
- `hotel_results` — accommodation information
- `itinerary` — planned daily activities
- `final_response` — consolidated travel response
- `messages` — conversation messages

PostgreSQL provides persistence for conversation history and relevant state information.

## 🛠️ Tech Stack

| Category | Technologies |
|---|---|
| Programming Language | Python 3.10+ |
| Backend Framework | FastAPI |
| Agent Orchestration | LangGraph |
| LLM Framework | LangChain |
| Language Model | Groq-hosted LLMs |
| Flight Research | AviationStack API |
| Web Research | Tavily Search API |
| Database | PostgreSQL |
| Frontend | HTML, CSS, JavaScript, Jinja2 |
| Optional Integrations | Google Places API, Google Maps API |

## 🔄 Workflow

1. **User Request:** The user describes a trip, including the destination, travel dates, preferences, or budget.
2. **Agent Execution:** The LangGraph workflow coordinates the flight, hotel, and itinerary agents according to the application's workflow.
3. **Information Retrieval:** Agents use their configured APIs and search tools to collect relevant information.
4. **Shared-State Updates:** Retrieved results and generated outputs are stored in the shared travel state.
5. **Response Generation:** The final response agent combines the available information into a consolidated travel plan.
6. **Persistence:** PostgreSQL stores conversation history and relevant state information for supported persistence workflows.

## 📂 Project Structure

```text
Tabi-Go-AI/
├── app.py                # FastAPI application entry point
├── backend.py            # LangGraph workflow and agent coordination
├── requirements.txt      # Python dependencies
├── static/               # CSS, JavaScript, and static assets
├── templates/            # Jinja2 HTML templates
└── tools/                # Flight and web-search integrations
```

*The structure above reflects the current project layout described in this README. Update it if your repository contains additional modules or directories.*

## ⚙️ Getting Started

### Prerequisites

- Python 3.10 or newer
- PostgreSQL
- Git
- API credentials for the services used by your application

### 1. Clone the Repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd Tabi-Go-AI
```

Replace the placeholder with your actual GitHub repository URL.

### 2. Create a Virtual Environment

**Windows:**

```bash
python -m venv venv
venv\Scripts\activate
```

**macOS / Linux:**

```bash
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies

```bash
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### 4. Configure Environment Variables

Create a `.env` file in the project root and configure the credentials required by your implementation.

Example:

```env
GROQ_API_KEY=your_groq_api_key
TAVILY_API_KEY=your_tavily_api_key
AVIATIONSTACK_API_KEY=your_aviationstack_api_key
DATABASE_URL=your_postgresql_connection_string
```

Add any additional credentials required by enabled integrations, such as Google Places or Google Maps.

**Important:** These are example variable names. Ensure they match the names your application actually reads. Never commit API keys, database passwords, or other secrets to GitHub.

Add the following to `.gitignore` if it is not already present:

```gitignore
.env
venv/
__pycache__/
*.py[cod]
```

### 5. Configure PostgreSQL

Create a PostgreSQL database and configure the connection string expected by your application.

Ensure the database schema, tables, and persistence mechanism are initialized according to your implementation.

### 6. Run the Application

If `app.py` exposes a FastAPI application object named `app`, run:

```bash
uvicorn app:app --reload
```

Open the local application at:

- Web interface: `http://127.0.0.1:8000`
- API documentation: `http://127.0.0.1:8000/docs`

The web interface route depends on the routes configured in your application.

## 🧪 Example Use Case

**Sample user request:**

> Plan a 3-day trip to Kyoto, Japan, with affordable hotels, major cultural attractions, and a day-wise itinerary.

**Expected workflow:**

- The Flight Agent researches relevant flight information.
- The Hotel Agent searches for suitable accommodation options.
- The Itinerary Agent organizes attractions and activities across three days.
- The Final Response Agent combines the available results into one structured travel plan.

The actual results depend on API availability, retrieved information, the configured workflow, and the user's requirements.

## 🎯 Project Objectives

- Simplify travel planning through a unified conversational interface.
- Demonstrate multi-agent orchestration using LangGraph.
- Integrate external APIs and web-search tools into an AI application.
- Maintain shared state across specialized agents.
- Generate structured itineraries from natural-language requests.
- Explore persistent conversational workflows using PostgreSQL.

## 🚀 Future Enhancements

- Real-time flight availability and price comparison.
- Hotel ranking based on budget, location, and user preferences.
- Personalized itineraries based on travel style and interests.
- Estimated travel time and route optimization between attractions.
- Multilingual travel planning.
- Budget estimation for flights, accommodation, transport, and activities.
- Improved error handling, API caching, and automated testing.



