import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Import the RAG service functions
from app.rag_service import query_rag_system

# Load environment variables
load_dotenv()
SERVER_PORT = int(os.getenv("SERVER_PORT", 8000))

# --- Pydantic Data Models ---
class ChatRequest(BaseModel):
    """Defines the expected format for an incoming chat query."""
    query: str = Field(..., description="The user's question about customs regulations.")

class Source(BaseModel):
    """Defines the structure for a source citation."""
    source_text_preview: str = Field(..., description="A snippet of the source document used.")

class ChatResponse(BaseModel):
    """Defines the format for the outgoing response."""
    answer: str = Field(..., description="The grounded answer from the LLM.")
    sources: list[Source] = Field(..., description="A list of source documents used for grounding.")

# --- FastAPI Initialization ---
app = FastAPI(
    title="NCS Inquiry Chatbot API",
    description="Internal API for Customs Officer RAG Chatbot.",
    version="1.0.0"
)

# --- CORS Configuration ---
# IMPORTANT: This allows the Next.js frontend (likely on port 3000) to communicate with this backend.
origins = [
    "http://localhost",
    "http://localhost:3000", # Next.js default port
    # In a real deployment, you would specify the frontend URL here
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- API Endpoints ---

@app.get("/")
def read_root():
    """Simple status check for the API."""
    return {"message": "NCS Inquiry Chatbot API is running. Use the /chat endpoint."}

@app.post("/chat", response_model=ChatResponse)
async def chat_with_customs_knowledge(request: ChatRequest):
    """
    Receives a user query and returns a grounded answer and citations
    from the Nigeria Customs knowledge base.
    """
    if not request.query or len(request.query.strip()) < 5:
        raise HTTPException(status_code=400, detail="Query must be at least 5 characters long.")

    try:
        # Call the RAG service to get the answer and sources
        result = query_rag_system(request.query)
        
        # Check for system initialization error (returned by query_rag_system)
        if result["answer"].startswith("System is not initialized"):
             raise HTTPException(status_code=503, detail=result["answer"])

        return ChatResponse(
            answer=result["answer"],
            sources=result["sources"]
        )
    except Exception as e:
        print(f"Server error during chat query: {e}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {e}")

# --- Startup Command ---
# To run this server:
# 1. Ensure you are in the 'backend/' directory.
# 2. Command: uvicorn app.main:app --reload --port 8000
#    (or the port defined in .env)
