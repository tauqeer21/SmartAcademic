# SmartAcademic 🎓
**AI-Powered Education Management System**  
Built for Hackathon 2025 by OSEN

---

## 🚀 Live Demo
- **Frontend:** [Deploy on Vercel]
- **Backend:** [Deploy on Railway]

## 🔑 Demo Credentials
| Role | ID | Password |
|------|----|----------|
| Dr. Arvind Sharma (Teacher) | T001 | t001 |
| Prof. Meena Joshi (Teacher) | T002 | t002 |
| Dr. Rajesh Kumar (Teacher) | T003 | t003 |
| Aarav Patel (Student ⭐ Top) | CS001 | cs001 |
| Priya Sharma (Student) | CS002 | cs002 |
| Vikram Nair (Student ⚠️ At Risk) | CS005 | cs005 |

## ✨ Features
- **AI Tools** — Question paper generator (PDF), Progress reports with AI remarks, MCQ generator, Rubric builder, Lesson planner, Forum auto-answer
- **Smart Attendance** — Camera-based face detection, bunk calculator, detention alerts
- **Analytics** — Risk scoring, grade distribution, CSV export
- **Report Card** — MST1/MST2/Final breakdown, radar chart, attendance history
- **CGPA Calculator** — Goal planner with required SGPA calculation
- **Automation** — Auto attendance alerts, assignment reminders, marks drop detection

## 🛠 Tech Stack
- **Frontend:** React 18 + Vite + Recharts
- **Backend:** Flask + SQLite/PostgreSQL
- **AI:** Groq (llama-3.3-70b) + Gemini (gemini-2.0-flash) fallback
- **Deploy:** Vercel (frontend) + Railway (backend)

## ⚙️ Local Setup

### Backend
```bash
cd backend
pip install -r requirements.txt
python seed_demo.py    # Creates demo data
python app.py          # Runs on port 5000
```

### Frontend
```bash
cd frontend
npm install
npm run dev            # Runs on port 5173
```

### Environment Variables (backend/.env)
```
JWT_SECRET_KEY=your-secret-key
GROQ_API_KEY=your-groq-key
GEMINI_API_KEY=your-gemini-key
```

## 📦 Deploy

### Railway (Backend)
1. New Project → GitHub repo → Root dir: `backend`
2. Add env vars: JWT_SECRET_KEY, GROQ_API_KEY, GEMINI_API_KEY
3. Run `python seed_demo.py` in Railway shell

### Vercel (Frontend)
1. New Project → GitHub repo → Root dir: `frontend`
2. Add env var: `VITE_API_URL=https://your-railway-url.railway.app/api`
3. Deploy