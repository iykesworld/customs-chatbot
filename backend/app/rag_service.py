import os
from dotenv import load_dotenv

# LangChain Imports for RAG Pipeline
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import TextLoader
from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain.chains import create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate

# --- Configuration ---
load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Define paths relative to backend/app/
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "..", "data", "customs_knowledge_base.txt")

rag_chain = None  # Global variable to hold initialized chain


def initialize_rag_system():
    """
    Initializes the RAG chain by loading the knowledge base,
    creating embeddings, and setting up the retriever.
    """
    global rag_chain

    if not OPENAI_API_KEY:
        print("❌ ERROR: OPENAI_API_KEY not found in environment variables.")
        return

    if not os.path.exists(DATA_PATH):
        print(f"❌ ERROR: Knowledge base file not found at {DATA_PATH}")
        return

    print("--- Initializing RAG System ---")

    try:
        # 1. Load the document
        loader = TextLoader(DATA_PATH, encoding="utf-8")
        documents = loader.load()

        # 2. Split document into manageable chunks
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=150,
            separators=["\n\n", "\n", ".", " ", ""],
        )
        texts = text_splitter.split_documents(documents)
        print(f"✅ Loaded {len(documents)} document(s) and split into {len(texts)} chunks.")

        # 3. Create Embeddings (new SDK-compatible call)
        embeddings = OpenAIEmbeddings(
            model="text-embedding-3-small",
            api_key=OPENAI_API_KEY,
        )

        # 4. Build FAISS vector store
        vector_store = FAISS.from_documents(texts, embeddings)
        retriever = vector_store.as_retriever(search_kwargs={"k": 3})
        print("✅ Vector store and retriever created.")

        # 5. System Prompt
        system_prompt = (
            "You are an authoritative Nigeria Customs Service (NCS) Internal Inquiry Chatbot. "
            "Your sole purpose is to assist NCS officers by providing accurate information "
            "from the provided context. Answer the user's question concisely, using only the "
            "information from the 'Context' below. You MUST cite the source section(s) "
            "that supported your answer at the end of your response."
            "\n\nContext: {context}"
        )

        prompt = ChatPromptTemplate.from_messages(
            [
                ("system", system_prompt),
                ("human", "{input}"),
            ]
        )

        # 6. Initialize Chat model
        llm = ChatOpenAI(
            model="gpt-4o-mini",
            temperature=0.0,
            api_key=OPENAI_API_KEY,
        )

        # 7. Combine LLM + Retriever into a RAG Chain
        document_chain = create_stuff_documents_chain(llm, prompt)
        rag_chain = create_retrieval_chain(retriever, document_chain)
        print("✅ RAG Retrieval Chain successfully initialized.")

    except Exception as e:
        print(f"❌ An error occurred during RAG initialization: {e}")
        rag_chain = None


def query_rag_system(query: str) -> dict:
    """
    Queries the initialized RAG system and returns the response and sources.
    """
    if not rag_chain:
        initialize_rag_system()
        if not rag_chain:
            return {
                "answer": "System not initialized. Please verify OPENAI_API_KEY and knowledge base.",
                "sources": [],
            }

    try:
        response = rag_chain.invoke({"input": query})
        answer = response.get("answer", "Could not generate an answer.")
        source_docs = response.get("context", [])

        sources = [
            {"source_text_preview": doc.page_content.split("\n")[0].strip()}
            for doc in source_docs
        ]

        return {"answer": answer, "sources": sources}

    except Exception as e:
        print(f"❌ An error occurred during query execution: {e}")
        return {
            "answer": f"An error occurred while processing the query. Details: {e}",
            "sources": [],
        }


# Initialize the RAG system on import
initialize_rag_system()
