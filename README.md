# 🛡️ InsureIQ — AI-Powered Insurance Policy Comparison System

A hackathon-ready Streamlit application that uses **Google Gemini + RAG** to compare
insurance policies, detect hidden clauses, and generate personalized recommendations.

---

## ✨ Features

| Feature | Description |
|---|---|
| 📄 PDF Upload | Upload 2+ insurance PDFs; text auto-extracted & indexed |
| 📊 Policy Comparison | Side-by-side AI comparison of 12+ metrics |
| ⚠️ Hidden Clause Detector | Identifies risky exclusions, co-pay traps, fine print |
| 🎯 Personalized Recommendation | Best match based on age, budget, family, health |
| 💬 RAG Chatbot | Ask questions; answers grounded in your actual documents |

---

## 🚀 Quick Start

### 1. Clone & enter the project
```bash
cd insurance_app
```

### 2. Create a virtual environment (recommended)
```bash
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
```

### 3. Install dependencies
```bash
pip install -r requirements.txt
```

### 4. Set up your API key
```bash
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY
```
Get a free Gemini API key at: https://aistudio.google.com/app/apikey

### 5. Run the app
```bash
streamlit run app.py
```

---

## 🗂️ Project Structure

```
insurance_app/
├── app.py                  # Main Streamlit application
├── utils/
│   ├── __init__.py
│   ├── pdf_processor.py    # PyMuPDF extraction + LangChain chunking
│   ├── vector_store.py     # ChromaDB + SentenceTransformers embeddings
│   └── gemini_helper.py    # All Gemini API prompts & parsing
├── uploads/                # Uploaded PDFs stored here (auto-created)
├── chroma_db/              # ChromaDB vector database (auto-created)
├── requirements.txt
├── .env.example
└── README.md
```

---

## 🔧 Tech Stack

- **UI**: Streamlit
- **PDF Extraction**: PyMuPDF (fitz)
- **Text Chunking**: LangChain RecursiveCharacterTextSplitter
- **Embeddings**: `sentence-transformers/all-MiniLM-L6-v2`
- **Vector DB**: ChromaDB (persistent local storage)
- **LLM**: Google Gemini 1.5 Flash
- **Env Management**: python-dotenv

---

## 📝 Notes

- The app stores PDFs in `uploads/` and vector data in `chroma_db/` — both created automatically.
- First run downloads the SentenceTransformer model (~90MB) — subsequent runs are instant.
- Gemini 1.5 Flash is used for speed; swap to `gemini-1.5-pro` in `gemini_helper.py` for higher quality.
- Long PDFs are truncated to fit Gemini's context window; key sections at start/end are preserved.
