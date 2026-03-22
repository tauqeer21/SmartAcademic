import os, sqlite3
from dotenv import load_dotenv
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "")
USE_PG = DATABASE_URL.startswith("postgresql")

if USE_PG:
    import psycopg2, psycopg2.extras
    def get_db():
        return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
else:
    DB_PATH = os.path.join(os.path.dirname(__file__), "academic.db")
    def get_db():
        conn = sqlite3.connect(DB_PATH, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        return conn

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    roll_no TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'student',
    gender TEXT DEFAULT 'male',
    course TEXT DEFAULT '',
    semester TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    section TEXT DEFAULT '',
    semester TEXT DEFAULT '',
    course TEXT DEFAULT '',
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS class_teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    teacher_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    UNIQUE(class_id, teacher_id, subject),
    FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS class_students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    student_roll TEXT NOT NULL,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(class_id, student_roll),
    FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    student_roll TEXT NOT NULL,
    subject TEXT NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Present',
    marked_by TEXT NOT NULL,
    UNIQUE(class_id, student_roll, subject, date),
    FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS semester_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    subject TEXT NOT NULL,
    teacher_id TEXT NOT NULL,
    total_lectures INTEGER DEFAULT 0,
    UNIQUE(class_id, subject, teacher_id)
);
CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    teacher_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    deadline TEXT NOT NULL,
    file_name TEXT DEFAULT '',
    file_path TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id INTEGER NOT NULL,
    student_roll TEXT NOT NULL,
    file_name TEXT DEFAULT '',
    file_path TEXT DEFAULT '',
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(assignment_id, student_roll),
    FOREIGN KEY(assignment_id) REFERENCES assignments(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    teacher_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    file_name TEXT DEFAULT '',
    file_path TEXT DEFAULT '',
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    teacher_id TEXT NOT NULL,
    subject TEXT DEFAULT '',
    title TEXT NOT NULL,
    body TEXT DEFAULT '',
    priority TEXT DEFAULT 'normal',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS timetable (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    teacher_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    day TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    room TEXT DEFAULT '',
    UNIQUE(class_id, subject, day, start_time),
    FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS exam_timetable (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    teacher_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    exam_type TEXT NOT NULL,
    exam_date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT DEFAULT '',
    room TEXT DEFAULT '',
    syllabus TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS marks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    student_roll TEXT NOT NULL,
    subject TEXT NOT NULL,
    exam_type TEXT NOT NULL,
    marks_obtained REAL DEFAULT 0,
    marks_total REAL DEFAULT 100,
    entered_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(class_id, student_roll, subject, exam_type),
    FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS forum_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    student_roll TEXT NOT NULL,
    subject TEXT DEFAULT '',
    title TEXT NOT NULL,
    body TEXT DEFAULT '',
    is_ai_answered INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS forum_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER NOT NULL,
    roll_no TEXT NOT NULL,
    responder_name TEXT NOT NULL,
    role TEXT DEFAULT 'student',
    answer TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(question_id) REFERENCES forum_questions(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS availability (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id TEXT NOT NULL,
    day TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    location TEXT DEFAULT '',
    note TEXT DEFAULT '',
    period_no TEXT DEFAULT '',
    class_name TEXT DEFAULT '',
    avail_type TEXT DEFAULT 'office',
    UNIQUE(teacher_id, day, start_time)
);
CREATE TABLE IF NOT EXISTS class_cancellations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    teacher_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    cancelled_date TEXT NOT NULL,
    reason TEXT DEFAULT '',
    rescheduled_to TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS study_time (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_roll TEXT NOT NULL,
    date TEXT NOT NULL,
    hours REAL NOT NULL,
    subject TEXT DEFAULT '',
    note TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_roll, date)
);
CREATE TABLE IF NOT EXISTS question_papers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id TEXT NOT NULL,
    class_id INTEGER DEFAULT 0,
    subject TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exam_dates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    teacher_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    exam_type TEXT NOT NULL,
    exam_date TEXT NOT NULL,
    syllabus_coverage REAL DEFAULT 100,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(class_id, subject, exam_type)
);

CREATE TABLE IF NOT EXISTS cgpa_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_roll TEXT NOT NULL,
    current_cgpa REAL DEFAULT 0,
    current_semesters INTEGER DEFAULT 0,
    target_cgpa REAL NOT NULL,
    target_semester INTEGER NOT NULL,
    credits_per_sem INTEGER DEFAULT 24,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_roll)
);

CREATE TABLE IF NOT EXISTS student_risk_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_roll TEXT NOT NULL,
    class_id INTEGER NOT NULL,
    risk_level TEXT DEFAULT 'low',
    risk_score REAL DEFAULT 0,
    att_trend REAL DEFAULT 0,
    marks_trend REAL DEFAULT 0,
    engagement_score REAL DEFAULT 0,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_roll, class_id)
);
"""

def init_db():
    if USE_PG:
        conn = get_db()
        c = conn.cursor()
        for stmt in [s.strip() for s in SCHEMA.split(';') if s.strip()]:
            pg = stmt.replace('INTEGER PRIMARY KEY AUTOINCREMENT','SERIAL PRIMARY KEY')\
                     .replace('DATETIME DEFAULT CURRENT_TIMESTAMP','TIMESTAMP DEFAULT NOW()')\
                     .replace('INSERT OR IGNORE','INSERT')\
                     .replace('INSERT OR REPLACE','INSERT')
            try: c.execute(pg)
            except: pass
        conn.commit(); conn.close()
    else:
        conn = get_db()
        conn.executescript(SCHEMA)
        conn.commit(); conn.close()
    print(f"[DB] Ready ({'PostgreSQL' if USE_PG else 'SQLite'})")

# This will be appended - but let's check current end of file

# ── Smart Attendance additions ──────────────────────────────────────────────
SMART_ATTENDANCE_TABLES = """
ALTER TABLE users ADD COLUMN photo_path TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN face_encoding TEXT DEFAULT '';

CREATE TABLE IF NOT EXISTS smart_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    teacher_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    date TEXT NOT NULL,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    status TEXT DEFAULT 'active',
    total_detected INTEGER DEFAULT 0,
    FOREIGN KEY(class_id) REFERENCES classes(id)
);

CREATE TABLE IF NOT EXISTS attendance_locks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    subject TEXT NOT NULL,
    date TEXT NOT NULL,
    locked_by TEXT NOT NULL,
    locked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    session_id INTEGER,
    UNIQUE(class_id, subject, date)
);

CREATE TABLE IF NOT EXISTS attendance_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    subject TEXT NOT NULL,
    date TEXT NOT NULL,
    student_roll TEXT NOT NULL,
    old_status TEXT,
    new_status TEXT,
    changed_by TEXT NOT NULL,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reason TEXT DEFAULT 'manual_correction'
);
"""

def init_smart_tables():
    """Run smart attendance table migrations safely"""
    from db_helpers import execute
    stmts = [s.strip() for s in SMART_ATTENDANCE_TABLES.strip().split(';') if s.strip()]
    for stmt in stmts:
        try:
            execute(stmt)
        except Exception:
            pass  # Column/table already exists — safe to ignore

# ── Automation additions ────────────────────────────────────────────────────
AUTOMATION_SQL = [
    "ALTER TABLE announcements ADD COLUMN target_roll TEXT DEFAULT ''",
    "ALTER TABLE announcements ADD COLUMN auto_type TEXT DEFAULT ''",
    "ALTER TABLE announcements ADD COLUMN is_automated INTEGER DEFAULT 0",
    """CREATE TABLE IF NOT EXISTS automation_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        auto_type TEXT NOT NULL,
        target_roll TEXT DEFAULT '',
        class_id INTEGER DEFAULT 0,
        message TEXT DEFAULT '',
        ran_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )""",
]

def init_automation_tables():
    from db_helpers import execute
    for stmt in AUTOMATION_SQL:
        try:
            execute(stmt)
        except Exception:
            pass  # column/table already exists

# ── New tables for detained list + assignment marks ─────────────────
EXTRA_SQL = [
    "ALTER TABLE submissions ADD COLUMN marks_obtained REAL DEFAULT NULL",
    "ALTER TABLE submissions ADD COLUMN marks_total REAL DEFAULT 10",
    """CREATE TABLE IF NOT EXISTS detained_list (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        class_id INTEGER NOT NULL,
        teacher_id TEXT NOT NULL,
        threshold REAL DEFAULT 75,
        generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE
    )""",
]

def init_extra_tables():
    from db_helpers import execute
    for stmt in EXTRA_SQL:
        try: execute(stmt)
        except Exception: pass

# ── New feature additions ────────────────────────────────────────────────────
NEW_FEATURE_SQL = [
    "ALTER TABLE submissions ADD COLUMN marks_obtained REAL DEFAULT NULL",
    "ALTER TABLE submissions ADD COLUMN marks_total REAL DEFAULT 10",
    """CREATE TABLE IF NOT EXISTS detained_lists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        class_id INTEGER NOT NULL,
        teacher_id TEXT NOT NULL,
        threshold REAL DEFAULT 75,
        generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        sent INTEGER DEFAULT 0
    )""",
]

def init_new_feature_tables():
    from db_helpers import execute
    for stmt in NEW_FEATURE_SQL:
        try:
            execute(stmt)
        except Exception:
            pass