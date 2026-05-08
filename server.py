"""
InsureIQ – Flask REST API Server
Serves the HTML dashboard and exposes REST endpoints for policy operations.
Run with:  python server.py
"""

import os
import re
import json
import time
from pathlib import Path
from dotenv import load_dotenv
from flask import Flask, request, jsonify, render_template, send_file

# Reuse existing utility modules
from utils.pdf_processor import extract_text_from_pdf, chunk_text
from utils.vector_store import VectorStore
from utils.groq_helper import GroqHelper
from utils.report_generator import generate_comparison_pdf

# ─── Load Environment ─────────────────────────────────────────────────────────
load_dotenv()

app = Flask(__name__, template_folder="templates", static_folder="static")
app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024  # 20 MB max upload

# ─── Ensure Folders ───────────────────────────────────────────────────────────
Path("uploads").mkdir(exist_ok=True)
Path("chroma_db").mkdir(exist_ok=True)

# ─── Initialise AI Services ──────────────────────────────────────────────────
api_key = os.getenv("GROQ_API_KEY", "")
if not api_key:
    print("⚠️  GROQ_API_KEY not found. Set it in your .env file.")

llm = GroqHelper(api_key) if api_key else None
vector_store = VectorStore()

# ─── In-Memory State ─────────────────────────────────────────────────────────
# Mirrors what Streamlit kept in session_state
state = {
    "uploaded_policies": {},     # {filename: {name, text, chunks, path}}
    "chat_history": [],          # [{role, content, timestamp}]
    "comparison_result": None,
    "hidden_clauses": None,
    "recommendation": None,
}


# ═══════════════════════════════════════════════════════════════════════════════
# ROUTES — Pages
# ═══════════════════════════════════════════════════════════════════════════════

@app.route("/")
def index():
    """Serve the main dashboard."""
    return render_template("index.html")


@app.route("/catalog")
def catalog():
    """Serve the insurance catalog page."""
    return render_template("catalog.html")


# ═══════════════════════════════════════════════════════════════════════════════
# API — Policy Upload & Management
# ═══════════════════════════════════════════════════════════════════════════════

@app.route("/api/policies", methods=["GET"])
def get_policies():
    """Return list of currently loaded policies."""
    policies = []
    for fname, info in state["uploaded_policies"].items():
        policies.append({
            "filename": fname,
            "name": info["name"],
            "chunks": info["chunks"],
        })
    return jsonify({"policies": policies, "count": len(policies)})


@app.route("/api/upload", methods=["POST"])
def upload_policy():
    """
    Upload one or more PDF policy files.
    Accepts multipart/form-data with field name 'files'.
    """
    if not request.files:
        return jsonify({"error": "No files provided"}), 400

    files = request.files.getlist("files")
    results = []

    for uf in files:
        if not uf.filename.lower().endswith(".pdf"):
            results.append({"filename": uf.filename, "status": "error",
                            "message": "Only PDF files are supported"})
            continue

        if uf.filename in state["uploaded_policies"]:
            results.append({"filename": uf.filename, "status": "skipped",
                            "message": "Already uploaded"})
            continue

        # Save file
        save_path = os.path.join("uploads", uf.filename)
        uf.save(save_path)

        # Extract text
        text = extract_text_from_pdf(save_path)
        if not text.strip():
            results.append({"filename": uf.filename, "status": "error",
                            "message": "Could not extract text from PDF"})
            continue

        # Chunk and index
        chunks = chunk_text(text)
        raw_name = Path(uf.filename).stem
        clean_name = re.sub(r'[0-9a-f]{8,}$', '', raw_name).strip('-_ ')
        clean_name = clean_name.replace('-', ' ').replace('_', ' ')
        clean_name = ' '.join(clean_name.split())
        policy_name = clean_name.title() if clean_name else raw_name

        vector_store.add_policy(policy_name, chunks)

        state["uploaded_policies"][uf.filename] = {
            "name": policy_name,
            "text": text,
            "chunks": len(chunks),
            "path": save_path,
        }

        results.append({
            "filename": uf.filename,
            "name": policy_name,
            "chunks": len(chunks),
            "status": "success",
        })

    return jsonify({"results": results, "total_policies": len(state["uploaded_policies"])})


@app.route("/api/policies/<filename>", methods=["DELETE"])
def delete_policy(filename):
    """Remove a single uploaded policy."""
    if filename not in state["uploaded_policies"]:
        return jsonify({"error": "Policy not found"}), 404

    info = state["uploaded_policies"].pop(filename)

    # Remove from vector store
    try:
        collection_name = vector_store._sanitize_name(f"policy_{info['name']}")
        vector_store.client.delete_collection(collection_name)
    except Exception:
        pass

    # Remove file from disk
    try:
        os.remove(info["path"])
    except Exception:
        pass

    return jsonify({"message": f"Deleted {info['name']}", "total_policies": len(state["uploaded_policies"])})


@app.route("/api/policies/clear", methods=["DELETE"])
def clear_all_policies():
    """Remove all uploaded policies and reset state."""
    state["uploaded_policies"] = {}
    state["chat_history"] = []
    state["comparison_result"] = None
    state["hidden_clauses"] = None
    state["recommendation"] = None
    vector_store.clear_all()
    return jsonify({"message": "All policies cleared"})


# ═══════════════════════════════════════════════════════════════════════════════
# API — AI Analysis
# ═══════════════════════════════════════════════════════════════════════════════

@app.route("/api/compare", methods=["POST"])
def compare_policies():
    """Run AI comparison across all uploaded policies."""
    if not llm:
        return jsonify({"error": "GROQ_API_KEY not configured"}), 500

    policy_texts = {info["name"]: info["text"]
                    for info in state["uploaded_policies"].values()}

    if len(policy_texts) < 2:
        return jsonify({"error": "Upload at least 2 policies to compare"}), 400

    result = llm.compare_policies(policy_texts)
    state["comparison_result"] = result
    return jsonify(result)


@app.route("/api/hidden-clauses", methods=["POST"])
def detect_hidden_clauses():
    """Detect hidden/risky clauses in all uploaded policies."""
    if not llm:
        return jsonify({"error": "GROQ_API_KEY not configured"}), 500

    policy_texts = {info["name"]: info["text"]
                    for info in state["uploaded_policies"].values()}

    if len(policy_texts) < 1:
        return jsonify({"error": "Upload at least 1 policy"}), 400

    clauses = llm.detect_hidden_clauses(policy_texts)
    state["hidden_clauses"] = clauses
    return jsonify(clauses)


@app.route("/api/recommend", methods=["POST"])
def get_recommendation():
    """Get a personalised policy recommendation."""
    if not llm:
        return jsonify({"error": "GROQ_API_KEY not configured"}), 500

    policy_texts = {info["name"]: info["text"]
                    for info in state["uploaded_policies"].values()}

    if len(policy_texts) < 1:
        return jsonify({"error": "Upload at least 1 policy"}), 400

    data = request.get_json() or {}
    user_profile = {
        "age": data.get("age", 35),
        "budget": data.get("budget", 5000),
        "family_size": data.get("family_size", 3),
        "pre_existing": data.get("pre_existing", "None"),
        "priorities": data.get("priorities", ["Family Floater", "Cashless Hospitals"]),
    }

    rec = llm.get_recommendation(policy_texts, user_profile)
    state["recommendation"] = rec
    return jsonify(rec)


# ═══════════════════════════════════════════════════════════════════════════════
# API — AI Chat (RAG)
# ═══════════════════════════════════════════════════════════════════════════════

@app.route("/api/chat", methods=["POST"])
def chat():
    """RAG-powered chat: answer user questions about their policies."""
    if not llm:
        return jsonify({"error": "GROQ_API_KEY not configured"}), 500

    data = request.get_json() or {}
    question = data.get("message", "").strip()

    if not question:
        return jsonify({"error": "Message is required"}), 400

    policy_names = [info["name"] for info in state["uploaded_policies"].values()]
    if not policy_names:
        return jsonify({"error": "Upload policies first"}), 400

    # Retrieve relevant context from vector store
    context = vector_store.retrieve_context(question, policy_names)
    answer = llm.answer_question(question, context, policy_names)

    # Store in chat history
    timestamp = time.strftime("%I:%M %p")
    state["chat_history"].append({"role": "user", "content": question, "timestamp": timestamp})
    state["chat_history"].append({"role": "ai", "content": answer, "timestamp": timestamp})

    return jsonify({
        "answer": answer,
        "timestamp": timestamp,
    })


@app.route("/api/chat/history", methods=["GET"])
def chat_history():
    """Return the full chat history."""
    return jsonify({"history": state["chat_history"]})


@app.route("/api/chat/clear", methods=["DELETE"])
def clear_chat():
    """Clear the chat history."""
    state["chat_history"] = []
    return jsonify({"message": "Chat cleared"})


# ═══════════════════════════════════════════════════════════════════════════════
# API — Report Download
# ═══════════════════════════════════════════════════════════════════════════════

@app.route("/api/report/download", methods=["GET"])
def download_report():
    """Generate and download the comparison report as PDF."""
    if not state["comparison_result"]:
        return jsonify({"error": "Run a comparison first"}), 400

    policy_names = [info["name"] for info in state["uploaded_policies"].values()]

    try:
        pdf_bytes = generate_comparison_pdf(
            comparison_result=state["comparison_result"],
            hidden_clauses=state["hidden_clauses"],
            recommendation=state["recommendation"],
            policy_names=policy_names,
        )
        import io
        return send_file(
            io.BytesIO(pdf_bytes),
            mimetype="application/pdf",
            as_attachment=True,
            download_name="InsureIQ_Policy_Report.pdf",
        )
    except Exception as e:
        return jsonify({"error": f"Could not generate PDF: {str(e)}"}), 500


# ═══════════════════════════════════════════════════════════════════════════════
# Run
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("🛡️  InsureIQ Flask Server starting…")
    print("   Dashboard: http://localhost:5000")
    print("   API Docs:  See server.py for all endpoints")
    app.run(host="0.0.0.0", port=5000, debug=True)
