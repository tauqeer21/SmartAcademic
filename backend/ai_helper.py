import os
from dotenv import load_dotenv

_dir = os.path.dirname(os.path.abspath(__file__))

def ask_gemini(prompt: str) -> str:
    """Ask AI — tries Groq first (free, fast), falls back to Gemini"""
    load_dotenv(os.path.join(_dir, '.env'), override=True)
    
    groq_key  = os.getenv("GROQ_API_KEY") or ""
    gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or ""

    # ── Try Groq first (free tier, generous limits) ──────────────────────
    if groq_key:
        try:
            print(f"[AI] Trying Groq with key: {groq_key[:12]}...")
            from groq import Groq
            client = Groq(api_key=groq_key)
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=1024,
            )
            print("[AI] Groq success!")
            return response.choices[0].message.content
        except Exception as e:
            print(f"[AI] Groq failed: {type(e).__name__}: {str(e)[:80]}")

    # ── Fall back to Gemini ───────────────────────────────────────────────
    if gemini_key:
        try:
            print(f"[AI] Trying Gemini with key: {gemini_key[:12]}...")
            from google import genai
            client = genai.Client(api_key=gemini_key)
            for model in ["gemini-2.0-flash", "gemini-2.0-flash-lite"]:
                try:
                    response = client.models.generate_content(model=model, contents=prompt)
                    print(f"[AI] Gemini success with {model}!")
                    return response.text
                except Exception as e:
                    print(f"[AI] {model} failed: {str(e)[:60]}")
                    continue
        except Exception as e:
            print(f"[AI] Gemini failed: {str(e)[:80]}")

    raise Exception("All AI providers failed. Check your API keys in .env")

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "uploads")

def _read_file(fp: str) -> str:
    full = os.path.join(UPLOAD_FOLDER, fp) if not os.path.isabs(fp) else fp
    if not os.path.exists(full): return ""
    ext = full.rsplit(".",1)[-1].lower()
    try:
        if ext == "txt":
            return open(full,"r",errors="ignore").read()[:3000]
        if ext == "pdf":
            import PyPDF2
            with open(full,"rb") as f:
                r=PyPDF2.PdfReader(f)
                return " ".join(p.extract_text() or "" for p in r.pages[:8])[:4000]
        if ext in ("docx","doc"):
            import docx
            return "\n".join(p.text for p in docx.Document(full).paragraphs)[:3000]
    except: pass
    return ""

def get_rich_context_for_class(class_id: int, subject: str = "") -> str:
    from db_helpers import fetchall
    q = "SELECT title, subject, category, file_path FROM notes WHERE class_id=?"
    p = [class_id]
    if subject:
        q += " AND subject=?"; p.append(subject)
    notes = fetchall(q, p)
    parts = []
    for n in notes[:6]:
        txt = _read_file(n["file_path"]) if n["file_path"] else ""
        if txt.strip():
            parts.append(f"=== [{n['category']}] {n['subject']} — {n['title']} ===\n{txt[:1500]}")
    return "\n\n".join(parts)