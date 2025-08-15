# Assistants Chat UI

A Next.js application for interacting with OpenAI Assistants API with vector store file search capabilities.

## Features

- **OpenAI Assistants Integration**: Support for multiple assistants with vector store file search
- **Real-time Chat**: Streaming and non-streaming responses
- **Session Management**: Persistent chat sessions with SQLite database
- **Authentication**: Passcode-based authentication
- **Parameter Controls**: Adjustable model parameters (temperature, reasoning effort, verbosity)
- **Citations**: File citations from vector store searches

## Setup

### Prerequisites

- Node.js 18+ 
- OpenAI API key
- Assistant IDs and Vector Store IDs (configured via environment variables)

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd assistants-ui
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env.local
```

4. Configure your `.env.local` file with:
```bash
OPENAI_API_KEY=your_openai_api_key_here
AUTH_PASSCODE=your_secure_passcode
SESSION_SECRET=your_session_secret_32_chars_min
ASSISTANTS_CONFIG=[{"id":"your_assistant_id","name":"Assistant Name","description":"Description","vector_store_ids":["your_vector_store_id"],"model":"gpt-5","default_parameters":{"temperature":0.7,"reasoning_effort":"medium","verbosity":"medium"}}]
NEXT_PUBLIC_ASSISTANTS_CONFIG=[same_as_above]
DATABASE_PATH=./data/assistants.db
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm start
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | Your OpenAI API key | Yes |
| `AUTH_PASSCODE` | Passcode for authentication | Yes |
| `SESSION_SECRET` | Secret for session encryption | Yes |
| `ASSISTANTS_CONFIG` | JSON array of assistant configurations | Yes |
| `NEXT_PUBLIC_ASSISTANTS_CONFIG` | Same as above, accessible client-side | Yes |
| `DATABASE_PATH` | Path to SQLite database file | Yes |

## Assistant Configuration

Each assistant in the configuration should have:

```json
{
  "id": "asst_xxxxx",
  "name": "Assistant Name",
  "description": "What this assistant does",
  "vector_store_ids": ["vs_xxxxx"],
  "model": "gpt-5",
  "default_parameters": {
    "temperature": 0.7,
    "reasoning_effort": "medium",
    "verbosity": "medium"
  }
}
```

## Supported Models

- gpt-5
- gpt-5-mini
- gpt-4.1
- gpt-4.1-mini
- gpt-4o
- gpt-4o-mini

Note: Some models (like gpt-5 family) may not support all parameters like temperature.

## Deployment

### Replit

1. Upload to GitHub (see instructions below)
2. Import from GitHub in Replit
3. Configure environment variables in Replit Secrets
4. Run with `npm run dev`

### Vercel

1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on push

## License

MIT