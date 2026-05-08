"""
Insurance Policy Comparison & Recommendation System
Main Streamlit Application
"""

import streamlit as st
import os
import json
import time
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import utility modules
from utils.pdf_processor import extract_text_from_pdf, chunk_text
from utils.vector_store import VectorStore
from utils.groq_helper import GroqHelper
from utils.report_generator import generate_comparison_pdf

# ─── Page Config ──────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="InsureIQ – Policy Comparison AI",
    page_icon="🛡️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ─── Custom CSS ───────────────────────────────────────────────────────────────
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=DM+Serif+Display&display=swap');

/* Base */
html, body, [class*="css"] {
    font-family: 'Space Grotesk', sans-serif;
}

/* Hide Streamlit chrome */
#MainMenu, footer, header {visibility: hidden;}

/* Background */
.stApp {
    background: linear-gradient(135deg, #0a0f1e 0%, #111827 50%, #0d1b2a 100%);
    color: #e2e8f0;
}

/* Sidebar */
[data-testid="stSidebar"] {
    background: rgba(15, 23, 42, 0.95) !important;
    border-right: 1px solid rgba(99, 102, 241, 0.2);
}

/* Title */
.main-title {
    font-family: 'DM Serif Display', serif;
    font-size: 2.8rem;
    background: linear-gradient(135deg, #818cf8, #38bdf8, #34d399);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: 0.2rem;
}

.subtitle {
    color: #94a3b8;
    font-size: 1rem;
    font-weight: 300;
    margin-bottom: 2rem;
}

/* Cards */
.feature-card {
    background: rgba(30, 41, 59, 0.7);
    border: 1px solid rgba(99, 102, 241, 0.25);
    border-radius: 16px;
    padding: 1.5rem;
    margin: 0.75rem 0;
    backdrop-filter: blur(10px);
    transition: border-color 0.3s;
}
.feature-card:hover { border-color: rgba(99, 102, 241, 0.6); }

/* Risk badges */
.risk-high {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.5);
    border-left: 4px solid #ef4444;
    border-radius: 8px;
    padding: 1rem 1.2rem;
    margin: 0.5rem 0;
}
.risk-medium {
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.4);
    border-left: 4px solid #f59e0b;
    border-radius: 8px;
    padding: 1rem 1.2rem;
    margin: 0.5rem 0;
}
.risk-low {
    background: rgba(52, 211, 153, 0.1);
    border: 1px solid rgba(52, 211, 153, 0.3);
    border-left: 4px solid #34d399;
    border-radius: 8px;
    padding: 1rem 1.2rem;
    margin: 0.5rem 0;
}

/* Recommendation card */
.rec-card {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(56, 189, 248, 0.1));
    border: 1px solid rgba(99, 102, 241, 0.4);
    border-radius: 16px;
    padding: 1.8rem;
    margin: 1rem 0;
}

/* Chat bubble */
.chat-user {
    background: rgba(99, 102, 241, 0.2);
    border-radius: 12px 12px 2px 12px;
    padding: 0.8rem 1rem;
    margin: 0.4rem 0;
    text-align: right;
}
.chat-ai {
    background: rgba(30, 41, 59, 0.8);
    border: 1px solid rgba(99, 102, 241, 0.2);
    border-radius: 2px 12px 12px 12px;
    padding: 0.8rem 1rem;
    margin: 0.4rem 0;
}

/* Metric styling */
[data-testid="metric-container"] {
    background: rgba(30, 41, 59, 0.6);
    border: 1px solid rgba(99, 102, 241, 0.2);
    border-radius: 12px;
    padding: 1rem;
}

/* Buttons */
.stButton > button {
    background: linear-gradient(135deg, #6366f1, #4f46e5);
    color: white;
    border: none;
    border-radius: 10px;
    padding: 0.6rem 1.4rem;
    font-weight: 600;
    font-family: 'Space Grotesk', sans-serif;
    transition: all 0.2s;
}
.stButton > button:hover {
    background: linear-gradient(135deg, #818cf8, #6366f1);
    transform: translateY(-1px);
    box-shadow: 0 8px 25px rgba(99, 102, 241, 0.4);
}

/* File uploader */
[data-testid="stFileUploader"] {
    border: 2px dashed rgba(99, 102, 241, 0.4) !important;
    border-radius: 12px !important;
    background: rgba(15, 23, 42, 0.5) !important;
}

/* Divider */
hr { border-color: rgba(99, 102, 241, 0.2) !important; }

/* Table */
.dataframe { border-radius: 12px; overflow: hidden; }

/* Section header */
.section-header {
    font-size: 1.3rem;
    font-weight: 600;
    color: #a5b4fc;
    margin: 1.5rem 0 0.8rem 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

/* Badge */
.badge {
    display: inline-block;
    padding: 0.2rem 0.7rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
}
.badge-indigo { background: rgba(99,102,241,0.2); color: #a5b4fc; border: 1px solid rgba(99,102,241,0.3); }
.badge-green  { background: rgba(52,211,153,0.15); color: #6ee7b7; border: 1px solid rgba(52,211,153,0.3); }
.badge-red    { background: rgba(239,68,68,0.15); color: #fca5a5; border: 1px solid rgba(239,68,68,0.3); }
</style>
""", unsafe_allow_html=True)

# ─── Ensure Folders Exist ─────────────────────────────────────────────────────
Path("uploads").mkdir(exist_ok=True)
Path("chroma_db").mkdir(exist_ok=True)

# ─── Session State Init ───────────────────────────────────────────────────────
if "uploaded_policies" not in st.session_state:
    st.session_state.uploaded_policies = {}   # {policy_name: text}
if "chat_history" not in st.session_state:
    st.session_state.chat_history = []
if "comparison_result" not in st.session_state:
    st.session_state.comparison_result = None
if "hidden_clauses" not in st.session_state:
    st.session_state.hidden_clauses = None
if "recommendation" not in st.session_state:
    st.session_state.recommendation = None

# ─── Validate API Key ─────────────────────────────────────────────────────────
api_key = os.getenv("GROQ_API_KEY", "")
if not api_key:
    st.error("⚠️  **GROQ_API_KEY** not found. Please set it in your `.env` file.")
    st.stop()

llm = GroqHelper(api_key)
vector_store = VectorStore()

# ═══════════════════════════════════════════════════════════════════════════════
# SIDEBAR
# ═══════════════════════════════════════════════════════════════════════════════
with st.sidebar:
    st.markdown("""
    <div style='text-align:center; padding: 1rem 0;'>
        <div style='font-size:2.5rem;'>🛡️</div>
        <div style='font-family: DM Serif Display; font-size:1.4rem; 
                    background: linear-gradient(135deg,#818cf8,#38bdf8);
                    -webkit-background-clip:text; -webkit-text-fill-color:transparent;'>
            InsureIQ
        </div>
        <div style='color:#64748b; font-size:0.8rem;'>AI Policy Analyst</div>
    </div>
    <hr/>
    """, unsafe_allow_html=True)

    st.markdown("### 📂 Upload Policies")
    uploaded_files = st.file_uploader(
        "Upload 2+ Insurance PDFs",
        type=["pdf"],
        accept_multiple_files=True,
        help="Upload at least 2 insurance policy PDFs to compare"
    )

    # Process uploaded files
    if uploaded_files:
        new_files = [f for f in uploaded_files
                     if f.name not in st.session_state.uploaded_policies]
        if new_files:
            with st.spinner("📄 Extracting & indexing PDFs…"):
                for uf in new_files:
                    save_path = f"uploads/{uf.name}"
                    with open(save_path, "wb") as fp:
                        fp.write(uf.getbuffer())

                    text = extract_text_from_pdf(save_path)
                    if not text.strip():
                        st.warning(f"⚠️ Could not extract text from **{uf.name}**")
                        continue

                    chunks = chunk_text(text)
                    # Clean up raw filename into a readable policy name
                    raw_name = Path(uf.name).stem
                    # Remove trailing hex hashes (8+ hex chars at the end)
                    import re as _re
                    clean_name = _re.sub(r'[0-9a-f]{8,}$', '', raw_name).strip('-_ ')
                    # Replace hyphens/underscores with spaces and title-case
                    clean_name = clean_name.replace('-', ' ').replace('_', ' ')
                    clean_name = ' '.join(clean_name.split())  # collapse whitespace
                    policy_name = clean_name.title() if clean_name else raw_name
                    vector_store.add_policy(policy_name, chunks)
                    st.session_state.uploaded_policies[uf.name] = {
                        "name": policy_name,
                        "text": text,
                        "chunks": len(chunks),
                        "path": save_path
                    }
                    st.success(f"✅ {uf.name}")

    # Show loaded policies
    if st.session_state.uploaded_policies:
        st.markdown("---")
        st.markdown("### 📋 Loaded Policies")
        for fname, info in st.session_state.uploaded_policies.items():
            st.markdown(f"""
            <div class='feature-card' style='padding:0.8rem 1rem;'>
                <div style='font-weight:600; font-size:0.9rem; color:#a5b4fc;'>
                    📄 {info['name']}
                </div>
                <div style='color:#64748b; font-size:0.75rem;'>
                    {info['chunks']} chunks indexed
                </div>
            </div>
            """, unsafe_allow_html=True)

        if st.button("🗑️ Clear All Policies", use_container_width=True):
            st.session_state.uploaded_policies = {}
            st.session_state.chat_history = []
            st.session_state.comparison_result = None
            st.session_state.hidden_clauses = None
            st.session_state.recommendation = None
            vector_store.clear_all()
            st.rerun()
    else:
        st.info("👆 Upload PDFs to get started")

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN AREA
# ═══════════════════════════════════════════════════════════════════════════════
st.markdown("""
<div class='main-title'>InsureIQ</div>
<div class='subtitle'>
    AI-Powered Insurance Policy Comparison & Recommendation Engine
</div>
""", unsafe_allow_html=True)

if not st.session_state.uploaded_policies:
    # ── Landing / Empty State ──────────────────────────────────────────────────
    cols = st.columns(3)
    features = [
        ("🔍", "Smart Extraction", "Extracts premiums, coverage, exclusions & 12+ key fields automatically"),
        ("⚠️", "Hidden Clause Detector", "Identifies risky sub-clauses, co-pay traps & fine print using AI"),
        ("🎯", "Personalized Match", "Recommends the best policy based on your age, budget & health profile"),
    ]
    for col, (icon, title, desc) in zip(cols, features):
        with col:
            st.markdown(f"""
            <div class='feature-card' style='text-align:center; min-height:140px;'>
                <div style='font-size:2rem; margin-bottom:0.5rem;'>{icon}</div>
                <div style='font-weight:700; color:#a5b4fc; margin-bottom:0.4rem;'>{title}</div>
                <div style='color:#64748b; font-size:0.85rem;'>{desc}</div>
            </div>
            """, unsafe_allow_html=True)

    st.markdown("---")
    st.markdown("""
    <div style='text-align:center; color:#475569; padding: 2rem;'>
        <div style='font-size:3rem;'>☝️</div>
        <div style='font-size:1.1rem;'>Upload at least <b>2 insurance policy PDFs</b> in the sidebar to begin</div>
    </div>
    """, unsafe_allow_html=True)
    st.stop()

# Require minimum 2 policies for comparison features
policy_count = len(st.session_state.uploaded_policies)
policy_names = [info["name"] for info in st.session_state.uploaded_policies.values()]
policy_texts = {info["name"]: info["text"]
                for info in st.session_state.uploaded_policies.values()}

st.markdown(f"""
<div style='display:flex; gap:0.5rem; align-items:center; margin-bottom:1.5rem;'>
    <span class='badge badge-indigo'>🛡️ {policy_count} Policies Loaded</span>
    {'<span class="badge badge-green">✅ Ready to Compare</span>' if policy_count >= 2 else '<span class="badge badge-red">⚠️ Upload at least 2</span>'}
</div>
""", unsafe_allow_html=True)

# ─── TABS ─────────────────────────────────────────────────────────────────────
tab1, tab2, tab3, tab4 = st.tabs([
    "📊 Compare Policies",
    "⚠️ Hidden Clauses",
    "🎯 Recommendation",
    "💬 Ask AI"
])

# ══════════════════════════════════════════════════════════════════
# TAB 1 — COMPARE POLICIES
# ══════════════════════════════════════════════════════════════════
with tab1:
    st.markdown("<div class='section-header'>📊 Side-by-Side Policy Comparison</div>",
                unsafe_allow_html=True)

    if policy_count < 2:
        st.warning("Please upload at least 2 policies to compare.")
    else:
        if st.button("🔄 Compare Policies", use_container_width=False):
            with st.spinner("🤖 AI is analyzing all policies…"):
                progress = st.progress(0, text="Extracting key metrics…")
                result = llm.compare_policies(policy_texts)
                progress.progress(100, text="Done!")
                time.sleep(0.3)
                progress.empty()
                st.session_state.comparison_result = result

        if st.session_state.comparison_result:
            result = st.session_state.comparison_result

            # ── Comparison Table ──────────────────────────────────────
            table_md = result.get("table", "")
            if table_md:
                st.markdown("### 📋 Comparison Table")
                # Parse markdown table into structured data
                import pandas as pd
                table_lines = [l.strip() for l in table_md.strip().split("\n") if l.strip()]
                data_lines = [l for l in table_lines
                              if not all(c in "-| " for c in l.strip("|").strip())]
                if len(data_lines) >= 2:
                    headers = [c.strip() for c in data_lines[0].strip("|").split("|")]
                    rows = []
                    for line in data_lines[1:]:
                        cells = [c.strip() for c in line.strip("|").split("|")]
                        rows.append(cells)
                    df = pd.DataFrame(rows, columns=headers)
                    # Style the dataframe
                    st.markdown("""
                    <style>
                    .comparison-table th {
                        background: linear-gradient(135deg, #6366f1, #4f46e5) !important;
                        color: white !important;
                        font-weight: 700 !important;
                        text-align: center !important;
                        padding: 12px 16px !important;
                        font-size: 0.85rem !important;
                    }
                    .comparison-table td {
                        padding: 10px 14px !important;
                        font-size: 0.82rem !important;
                        color: #e2e8f0 !important;
                        border-bottom: 1px solid rgba(99, 102, 241, 0.15) !important;
                    }
                    .comparison-table tr:nth-child(even) td {
                        background: rgba(30, 41, 59, 0.6) !important;
                    }
                    .comparison-table tr:nth-child(odd) td {
                        background: rgba(20, 30, 48, 0.6) !important;
                    }
                    .comparison-table td:first-child {
                        font-weight: 600 !important;
                        color: #a5b4fc !important;
                    }
                    .comparison-table {
                        border-radius: 12px !important;
                        overflow: hidden !important;
                        border: 1px solid rgba(99, 102, 241, 0.25) !important;
                    }
                    </style>
                    """, unsafe_allow_html=True)
                    st.markdown(
                        df.to_html(index=False, classes="comparison-table", escape=False),
                        unsafe_allow_html=True
                    )
                else:
                    st.markdown(table_md, unsafe_allow_html=True)

            # ── Key Metrics Cards ─────────────────────────────────────
            metrics = result.get("metrics", {})
            if metrics:
                st.markdown("### 📈 Key Metrics at a Glance")
                metric_cols = st.columns(len(policy_names))
                for col, pname in zip(metric_cols, policy_names):
                    pmetrics = metrics.get(pname, {})
                    with col:
                        st.markdown(f"""
                        <div class='feature-card' style='text-align:center;'>
                            <div style='font-weight:700; color:#a5b4fc;
                                        font-size:1rem; margin-bottom:0.6rem;'>
                                📄 {pname}
                            </div>
                        </div>
                        """, unsafe_allow_html=True)
                        for key, val in list(pmetrics.items())[:5]:
                            st.metric(label=key, value=str(val)[:30])

            # ── Winner Banner ─────────────────────────────────────────
            winner = result.get("winner", "")
            winner_reason = result.get("winner_reason", "")
            if winner:
                st.markdown(f"""
                <div style='background: linear-gradient(135deg, rgba(52,211,153,0.15),
                            rgba(99,102,241,0.1)); border: 1px solid rgba(52,211,153,0.4);
                            border-radius: 14px; padding: 1.4rem 1.8rem; margin: 1.2rem 0;
                            text-align: center;'>
                    <div style='font-size: 0.8rem; color: #34d399; text-transform: uppercase;
                                letter-spacing: 0.1em; font-weight: 600;'>🏆 Best Overall</div>
                    <div style='font-size: 1.6rem; font-weight: 700; color: #f8fafc;
                                margin: 0.4rem 0;'>{winner}</div>
                    <div style='color: #94a3b8; font-size: 0.9rem;'>{winner_reason}</div>
                </div>
                """, unsafe_allow_html=True)

            # ── AI Analysis (expanded by default) ─────────────────────
            summary = result.get("summary", "")
            if summary:
                with st.expander("📝 Detailed AI Analysis", expanded=True):
                    st.markdown(summary)

            # ── PDF Download ──────────────────────────────────────────
            st.markdown("---")
            st.markdown("### 📥 Download Report")
            st.markdown(
                "<p style='color:#64748b; font-size:0.85rem;'>"
                "Download a comprehensive PDF report containing comparison tables, "
                "hidden clause analysis, and recommendations (if available).</p>",
                unsafe_allow_html=True
            )
            try:
                pdf_bytes = generate_comparison_pdf(
                    comparison_result=result,
                    hidden_clauses=st.session_state.hidden_clauses,
                    recommendation=st.session_state.recommendation,
                    policy_names=policy_names,
                )
                st.download_button(
                    label="📄 Download Full Report as PDF",
                    data=pdf_bytes,
                    file_name="InsureIQ_Policy_Report.pdf",
                    mime="application/pdf",
                    use_container_width=True,
                )
            except Exception as e:
                st.error(f"Could not generate PDF: {e}")
                # Fallback to text download
                if "raw" in result:
                    st.download_button(
                        label="⬇️ Download as Text (fallback)",
                        data=result["raw"],
                        file_name="policy_comparison.txt",
                        mime="text/plain"
                    )

# ══════════════════════════════════════════════════════════════════
# TAB 2 — HIDDEN CLAUSES
# ══════════════════════════════════════════════════════════════════
with tab2:
    st.markdown("<div class='section-header'>⚠️ Hidden Clause & Risk Detector</div>",
                unsafe_allow_html=True)
    st.markdown(
        "<p style='color:#64748b;'>AI scans each policy for risky exclusions, co-pay traps, "
        "waiting period surprises, and fine-print conditions.</p>",
        unsafe_allow_html=True
    )

    if policy_count < 1:
        st.warning("Upload at least one policy to detect hidden clauses.")
    else:
        if st.button("🔍 Detect Hidden Clauses", use_container_width=False):
            with st.spinner("🔎 Scanning for risky clauses…"):
                progress = st.progress(0, text="Analyzing fine print…")
                clauses = llm.detect_hidden_clauses(policy_texts)
                progress.progress(100, text="Scan complete!")
                time.sleep(0.3)
                progress.empty()
                st.session_state.hidden_clauses = clauses

        if st.session_state.hidden_clauses:
            for policy_name, items in st.session_state.hidden_clauses.items():
                st.markdown(f"### 📄 {policy_name}")
                if not items:
                    st.success("✅ No major hidden clauses detected.")
                    continue
                for item in items:
                    severity = item.get("severity", "low").lower()
                    css_class = f"risk-{severity}" if severity in ("high","medium","low") else "risk-low"
                    severity_emoji = {"high": "🔴", "medium": "🟡", "low": "🟢"}.get(severity, "⚪")
                    st.markdown(f"""
                    <div class='{css_class}'>
                        <div style='font-weight:700; margin-bottom:0.3rem;'>
                            {severity_emoji} {item.get('clause', 'Clause')}
                            &nbsp; <span style='font-size:0.75rem; opacity:0.7;'>
                                [{severity.upper()} RISK]
                            </span>
                        </div>
                        <div style='color:#cbd5e1; font-size:0.9rem;'>
                            {item.get('explanation', '')}
                        </div>
                    </div>
                    """, unsafe_allow_html=True)
                st.markdown("---")

# ══════════════════════════════════════════════════════════════════
# TAB 3 — RECOMMENDATION
# ══════════════════════════════════════════════════════════════════
with tab3:
    st.markdown("<div class='section-header'>🎯 Personalized Policy Recommendation</div>",
                unsafe_allow_html=True)
    st.markdown(
        "<p style='color:#64748b;'>Tell us about yourself and we'll recommend the best policy from your uploads.</p>",
        unsafe_allow_html=True
    )

    col1, col2 = st.columns(2)
    with col1:
        user_age = st.number_input("👤 Your Age", min_value=18, max_value=100, value=35)
        family_size = st.number_input("👨‍👩‍👧 Family Size", min_value=1, max_value=10, value=3)
    with col2:
        budget = st.number_input("💰 Monthly Budget (₹)", min_value=500, max_value=50000,
                                 value=5000, step=500)
        pre_existing = st.text_input("🏥 Pre-existing Conditions",
                                     placeholder="e.g., Diabetes, Hypertension, None")

    priorities = st.multiselect(
        "⭐ Your Coverage Priorities",
        ["Maternity Benefits", "Critical Illness", "Family Floater",
         "Low Waiting Period", "High Sum Insured", "Cashless Hospitals",
         "No Co-pay", "Mental Health Coverage"],
        default=["Family Floater", "Cashless Hospitals"]
    )

    if st.button("🎯 Get My Recommendation", use_container_width=False):
        if policy_count < 1:
            st.warning("Upload at least one policy first.")
        else:
            user_profile = {
                "age": user_age,
                "budget": budget,
                "family_size": family_size,
                "pre_existing": pre_existing or "None",
                "priorities": priorities
            }
            with st.spinner("🤖 Finding your perfect policy match…"):
                progress = st.progress(0, text="Matching profile to policies…")
                rec = llm.get_recommendation(policy_texts, user_profile)
                progress.progress(100, text="Match found!")
                time.sleep(0.3)
                progress.empty()
                st.session_state.recommendation = rec

    if st.session_state.recommendation:
        rec = st.session_state.recommendation
        st.markdown(f"""
        <div class='rec-card'>
            <div style='font-size:0.8rem; color:#a5b4fc; font-weight:600; 
                        text-transform:uppercase; letter-spacing:0.1em;'>
                🏆 Best Match
            </div>
            <div style='font-size:1.8rem; font-weight:700; color:#f8fafc; margin:0.5rem 0;'>
                {rec.get('recommended_policy', 'N/A')}
            </div>
            <div style='color:#94a3b8; font-size:0.95rem; line-height:1.6;'>
                {rec.get('reason', '')}
            </div>
        </div>
        """, unsafe_allow_html=True)

        if "pros" in rec and rec["pros"]:
            st.markdown("#### ✅ Why it's great for you")
            for pro in rec["pros"]:
                st.markdown(f"- {pro}")

        if "cons" in rec and rec["cons"]:
            st.markdown("#### ⚠️ Things to keep in mind")
            for con in rec["cons"]:
                st.markdown(f"- {con}")

        if "alternatives" in rec:
            with st.expander("📋 Other Options"):
                st.markdown(rec["alternatives"])

# ══════════════════════════════════════════════════════════════════
# TAB 4 — CHATBOT
# ══════════════════════════════════════════════════════════════════
with tab4:
    st.markdown("<div class='section-header'>💬 Ask Questions About Your Policies</div>",
                unsafe_allow_html=True)
    st.markdown(
        "<p style='color:#64748b;'>Ask anything about your uploaded policies. "
        "Uses RAG — retrieves relevant chunks before answering.</p>",
        unsafe_allow_html=True
    )

    # Example questions
    examples = [
        "Which policy is better for family coverage?",
        "Which has fewer exclusions?",
        "Compare maternity benefits across policies",
        "Which policy has better ICU coverage?",
    ]
    st.markdown("**Quick questions:**")
    eq_cols = st.columns(2)
    for i, ex in enumerate(examples):
        with eq_cols[i % 2]:
            if st.button(f"💡 {ex}", key=f"eq_{i}", use_container_width=True):
                st.session_state.chat_history.append({"role": "user", "content": ex})
                with st.spinner("Thinking…"):
                    context_chunks = vector_store.retrieve_context(ex, policy_names)
                    answer = llm.answer_question(ex, context_chunks, list(policy_texts.keys()))
                    st.session_state.chat_history.append({"role": "ai", "content": answer})
                st.rerun()

    st.markdown("---")

    # Chat history
    if st.session_state.chat_history:
        for msg in st.session_state.chat_history:
            if msg["role"] == "user":
                st.markdown(f"""
                <div class='chat-user'>
                    <span style='color:#c7d2fe;'>🧑 You</span><br/>
                    {msg['content']}
                </div>
                """, unsafe_allow_html=True)
            else:
                st.markdown(f"""
                <div class='chat-ai'>
                    <span style='color:#a5b4fc;'>🤖 InsureIQ</span><br/>
                    {msg['content']}
                </div>
                """, unsafe_allow_html=True)

        if st.button("🗑️ Clear Chat"):
            st.session_state.chat_history = []
            st.rerun()

    # Input
    user_q = st.text_input(
        "Ask a question…",
        placeholder="e.g., Which policy covers pre-existing diabetes?",
        label_visibility="collapsed",
        key="chat_input"
    )
    if st.button("➤ Send", key="send_btn") and user_q.strip():
        st.session_state.chat_history.append({"role": "user", "content": user_q})
        with st.spinner("🔍 Searching policies…"):
            context_chunks = vector_store.retrieve_context(user_q, policy_names)
            answer = llm.answer_question(user_q, context_chunks, list(policy_texts.keys()))
            st.session_state.chat_history.append({"role": "ai", "content": answer})
        st.rerun()
