"""
SmartAcademic — Full Demo Seed v2
Run: python seed_demo.py
Creates realistic demo data for all features.

Demo Logins:
  Teachers: T001/t001  T002/t002  T003/t003
  Students: CS001/cs001 ... CS012/cs012
"""
import random
from datetime import date, timedelta
from database import init_db, get_db, USE_PG
from flask_bcrypt import generate_password_hash

random.seed(42)  # Fixed seed for reproducible results — NO more random variations!

init_db()
conn = get_db()
ph = lambda p: generate_password_hash(p).decode()

def sql(q, p=()):
    if USE_PG:
        c = conn.cursor(); c.execute(q.replace('?','%s'), p)
        try: return c.fetchone()[0]
        except: return None
    else:
        c = conn.execute(q, p); conn.commit(); return c.lastrowid

def sqls(q, p=()):
    if USE_PG:
        c = conn.cursor(); c.execute(q.replace('?','%s'), p); return c.fetchall()
    else:
        return conn.execute(q, p).fetchall()

def ins(q, p):
    try:
        if USE_PG:
            c = conn.cursor()
            c.execute(q.replace('?','%s'), p)
            conn.commit()
            try: return c.fetchone()[0]
            except: return None
        else:
            c = conn.execute(q, p); conn.commit(); return c.lastrowid
    except Exception as e:
        if USE_PG: conn.rollback()
        return None

# ─────────────────────────────────────────────
# 0. WIPE ALL EXISTING DEMO DATA
#    So re-running seed always gives clean correct data
# ─────────────────────────────────────────────
print("Wiping old demo data...")
WIPE_TABLES = [
    "forum_answers", "forum_questions",
    "submissions", "assignments",
    "announcements",
    "attendance", "semester_config",
    "marks",
    "exam_timetable",
    "timetable",
    "availability",
    "notes",
    "class_students", "class_teachers",
    "classes",
]
DEMO_ROLLS = ["T001","T002","T003",
              "CS001","CS002","CS003","CS004","CS005","CS006",
              "CS007","CS008","CS009","CS010","CS011","CS012"]
for tbl in WIPE_TABLES:
    try: conn.execute(f"DELETE FROM {tbl}"); conn.commit()
    except: pass
# Only wipe demo users, keep any real users
for roll in DEMO_ROLLS:
    try: conn.execute("DELETE FROM users WHERE roll_no=?", (roll,)); conn.commit()
    except: pass
print("  ✓ Old data wiped")


# ─────────────────────────────────────────────
print("Seeding teachers...")
TEACHERS = [
    ("T001", "Dr. Arvind Sharma",  "male"),
    ("T002", "Prof. Meena Joshi",  "female"),
    ("T003", "Dr. Rajesh Kumar",   "male"),
]
for roll, name, gender in TEACHERS:
    ins("INSERT OR IGNORE INTO users (roll_no,name,password,role,gender) VALUES (?,?,?,?,?)",
        (roll, name, ph(roll.lower()), "teacher", gender))
print(f"  ✓ {len(TEACHERS)} teachers")

# ─────────────────────────────────────────────
# 2. STUDENTS — realistic varied profiles
# ─────────────────────────────────────────────
print("Seeding students...")
STUDENTS = [
    ("CS001","Aarav Patel",    "male",   "B.Tech CSE","4"),
    ("CS002","Priya Sharma",   "female", "B.Tech CSE","4"),
    ("CS003","Rohit Verma",    "male",   "B.Tech CSE","4"),
    ("CS004","Anjali Singh",   "female", "B.Tech CSE","4"),
    ("CS005","Vikram Nair",    "male",   "B.Tech CSE","4"),
    ("CS006","Sneha Gupta",    "female", "B.Tech CSE","4"),
    ("CS007","Karan Mehta",    "male",   "B.Tech CSE","4"),
    ("CS008","Divya Reddy",    "female", "B.Tech CSE","4"),
    ("CS009","Arjun Yadav",    "male",   "B.Tech CSE","4"),
    ("CS010","Pooja Mishra",   "female", "B.Tech CSE","4"),
    ("CS011","Nikhil Joshi",   "male",   "B.Tech CSE","4"),
    ("CS012","Riya Bansal",    "female", "B.Tech CSE","4"),
]
for roll, name, gender, course, sem in STUDENTS:
    ins("INSERT OR IGNORE INTO users (roll_no,name,password,role,gender,course,semester) VALUES (?,?,?,?,?,?,?)",
        (roll, name, ph(roll.lower()), "student", gender, course, sem))
print(f"  ✓ {len(STUDENTS)} students")

# ─────────────────────────────────────────────
# 3. CLASS
# ─────────────────────────────────────────────
print("Seeding class...")
existing = sqls("SELECT id FROM classes WHERE name='CSE-A' AND created_by='T001'")
if existing:
    CLASS_ID = existing[0][0] if USE_PG else existing[0]["id"]
    print(f"  ✓ Class exists (id={CLASS_ID})")
else:
    CLASS_ID = ins("INSERT OR IGNORE INTO classes (name,section,semester,course,created_by) VALUES (?,?,?,?,?)",
                   ("CSE-A","A","4","B.Tech CSE","T001"))
    print(f"  ✓ Class created (id={CLASS_ID})")

# ─────────────────────────────────────────────
# 4. SUBJECTS — T001 teaches 2, T002 teaches 2, T003 teaches 1
# ─────────────────────────────────────────────
print("Seeding subjects...")
SUBJECTS = [
    ("T001", "Data Structures"),
    ("T001", "Operating Systems"),
    ("T002", "Database Management"),
    ("T002", "Computer Networks"),
    ("T003", "Software Engineering"),
]
for tid, subj in SUBJECTS:
    ins("INSERT OR IGNORE INTO class_teachers (class_id,teacher_id,subject) VALUES (?,?,?)",
        (CLASS_ID, tid, subj))
print(f"  ✓ {len(SUBJECTS)} subjects")

# ─────────────────────────────────────────────
# 5. ENROLL STUDENTS
# ─────────────────────────────────────────────
print("Enrolling students...")
for roll, *_ in STUDENTS:
    ins("INSERT OR IGNORE INTO class_students (class_id,student_roll) VALUES (?,?)",
        (CLASS_ID, roll))
print(f"  ✓ {len(STUDENTS)} enrolled")

# ─────────────────────────────────────────────
# 6. SEMESTER CONFIG — 60 lectures each
# ─────────────────────────────────────────────
for tid, subj in SUBJECTS:
    ins("INSERT OR IGNORE INTO semester_config (class_id,subject,teacher_id,total_lectures) VALUES (?,?,?,?)",
        (CLASS_ID, subj, tid, 60))
print("  ✓ Semester config (60 lectures each)")

# ─────────────────────────────────────────────
# 7. ATTENDANCE — deterministic, realistic
#    IMPORTANT: Each student gets a FIXED attendance pattern
#    CS005, CS007 = poor (below 75%)  in ONLY 2 subjects (not all 5!)
#    CS001, CS004, CS010 = excellent
#    Everyone else = safe or borderline in some subjects
# ─────────────────────────────────────────────
print("Seeding attendance...")

# Per-student per-subject attendance percentages — DETERMINISTIC
# Format: {roll: {subject: pct}}
ATTENDANCE = {
    # CS001 — top student, safe in all
    "CS001": {"Data Structures":92,"Operating Systems":90,"Database Management":88,"Computer Networks":91,"Software Engineering":93},
    # CS002 — good student, all safe
    "CS002": {"Data Structures":85,"Operating Systems":82,"Database Management":88,"Computer Networks":84,"Software Engineering":86},
    # CS003 — borderline in 1 subject
    "CS003": {"Data Structures":78,"Operating Systems":76,"Database Management":72,"Computer Networks":80,"Software Engineering":79},
    # CS004 — excellent
    "CS004": {"Data Structures":95,"Operating Systems":94,"Database Management":93,"Computer Networks":96,"Software Engineering":95},
    # CS005 — at risk in DS and OS only (T001's subjects)
    "CS005": {"Data Structures":62,"Operating Systems":65,"Database Management":78,"Computer Networks":76,"Software Engineering":77},
    # CS006 — good
    "CS006": {"Data Structures":84,"Operating Systems":86,"Database Management":82,"Computer Networks":85,"Software Engineering":88},
    # CS007 — at risk in DBMS and Networks (T002's subjects)
    "CS007": {"Data Structures":80,"Operating Systems":78,"Database Management":58,"Computer Networks":61,"Software Engineering":79},
    # CS008 — excellent
    "CS008": {"Data Structures":91,"Operating Systems":89,"Database Management":92,"Computer Networks":90,"Software Engineering":94},
    # CS009 — borderline, safe
    "CS009": {"Data Structures":76,"Operating Systems":75,"Database Management":77,"Computer Networks":78,"Software Engineering":76},
    # CS010 — top student
    "CS010": {"Data Structures":97,"Operating Systems":95,"Database Management":96,"Computer Networks":94,"Software Engineering":98},
    # CS011 — at risk in SE only (T003's subject)
    "CS011": {"Data Structures":80,"Operating Systems":82,"Database Management":79,"Computer Networks":78,"Software Engineering":63},
    # CS012 — good
    "CS012": {"Data Structures":83,"Operating Systems":85,"Database Management":87,"Computer Networks":82,"Software Engineering":84},
}

today = date.today()
att_count = 0
for subj_idx, (tid, subj) in enumerate(SUBJECTS):
    # Generate ~21-22 class dates over 60 days (every 2nd weekday)
    # More classes = more accurate percentage representation
    class_dates = []
    for d in range(60, 0, -1):
        dt = today - timedelta(days=d)
        if dt.weekday() < 5 and (dt.toordinal() + subj_idx) % 2 == 0:
            class_dates.append(dt)

    for roll, *_ in STUDENTS:
        target_pct = ATTENDANCE.get(roll, {}).get(subj, 80)
        total_classes = len(class_dates)
        # Calculate how many to mark present to hit exactly target_pct
        target_present = round(target_pct / 100 * total_classes)
        # Distribute: mark first N as present, rest absent (deterministic)
        for j, dt in enumerate(class_dates):
            status = "Present" if j < target_present else "Absent"
            try:
                conn.execute(
                    "INSERT OR IGNORE INTO attendance (class_id,student_roll,subject,date,status,marked_by) VALUES (?,?,?,?,?,?)",
                    (CLASS_ID, roll, subj, str(dt), status, tid)
                )
                att_count += 1
            except: pass
conn.commit()
print(f"  ✓ {att_count} attendance records")
print("  → CS005: at risk in Data Structures, Operating Systems")
print("  → CS007: at risk in Database Management, Computer Networks")
print("  → CS011: at risk in Software Engineering")

# ─────────────────────────────────────────────
# 8. MARKS — realistic, deterministic per teacher
#    T001 students: DS + OS marks
#    T002 students: DBMS + Networks marks
#    T003 students: SE marks
# ─────────────────────────────────────────────
print("Seeding marks...")

EXAM_TYPES = [("MST1", 30), ("MST2", 30), ("Final", 80)]

# Per-student base performance (0-100%), add small per-subject variance
BASE_MARKS = {
    "CS001":86,"CS002":76,"CS003":64,"CS004":93,
    "CS005":54,"CS006":74,"CS007":47,"CS008":88,
    "CS009":71,"CS010":95,"CS011":61,"CS012":80,
}
# Per-subject variance — makes each teacher's chart look different
SUBJ_VARIANCE = {
    "Data Structures":   {"CS001":4,"CS002":-2,"CS003":3,"CS004":2,"CS005":-4,"CS006":5,"CS007":8,"CS008":-3,"CS009":4,"CS010":3,"CS011":6,"CS012":-3},
    "Operating Systems": {"CS001":-3,"CS002":5,"CS003":-4,"CS004":3,"CS005":6,"CS006":-2,"CS007":4,"CS008":4,"CS009":-5,"CS010":-2,"CS011":-4,"CS012":5},
    "Database Management":{"CS001":2,"CS002":8,"CS003":-3,"CS004":-2,"CS005":-6,"CS006":3,"CS007":5,"CS008":2,"CS009":6,"CS010":2,"CS011":4,"CS012":-4},
    "Computer Networks": {"CS001":-4,"CS002":-3,"CS003":6,"CS004":4,"CS005":3,"CS006":-5,"CS007":-8,"CS008":5,"CS009":-2,"CS010":1,"CS011":3,"CS012":7},
    "Software Engineering":{"CS001":3,"CS002":-4,"CS003":-2,"CS004":1,"CS005":5,"CS006":4,"CS007":3,"CS008":-2,"CS009":3,"CS010":4,"CS011":-6,"CS012":2},
}
# MST trend — show improvement or decline between MST1→MST2
MST_TREND = {
    "CS001":3,"CS002":2,"CS003":-2,"CS004":1,"CS005":4,"CS006":-3,
    "CS007":5,"CS008":-1,"CS009":2,"CS010":1,"CS011":3,"CS012":-2,
}

marks_count = 0
for tid, subj in SUBJECTS:
    for exam_type, total in EXAM_TYPES:
        for roll, *_ in STUDENTS:
            base = BASE_MARKS.get(roll, 70)
            var  = SUBJ_VARIANCE.get(subj, {}).get(roll, 0)
            # MST1 vs MST2 trend
            if exam_type == "MST2":
                base += MST_TREND.get(roll, 0)
            elif exam_type == "Final":
                # Final is average of MST trend + base
                base += MST_TREND.get(roll, 0) // 2
            pct     = min(98, max(25, base + var))
            obtained = round((pct / 100) * total, 1)
            try:
                conn.execute(
                    "INSERT OR IGNORE INTO marks (class_id,student_roll,subject,exam_type,marks_obtained,marks_total,entered_by) VALUES (?,?,?,?,?,?,?)",
                    (CLASS_ID, roll, subj, exam_type, obtained, total, tid)
                )
                marks_count += 1
            except: pass
conn.commit()
print(f"  ✓ {marks_count} marks records (deterministic, per-teacher variance)")

# ─────────────────────────────────────────────
# 9. ASSIGNMENTS — mix of past + upcoming
# ─────────────────────────────────────────────
print("Seeding assignments...")
ASSIGNMENTS = [
    ("T001","Data Structures",     "Implement AVL Tree",              "Build a self-balancing AVL tree in C++ with insert, delete and search.",    -8),
    ("T001","Operating Systems",   "Process Scheduling Simulation",   "Simulate Round Robin and FCFS scheduling in Python.",                       -3),
    ("T001","Data Structures",     "Graph Traversal Algorithms",      "Implement BFS and DFS with time complexity analysis.",                       7),
    ("T002","Database Management", "ER Diagram for E-commerce",       "Design a complete ER diagram for an e-commerce platform.",                  -5),
    ("T002","Computer Networks",   "TCP/IP Protocol Analysis",        "Use Wireshark to capture and analyze packets. Submit report.",               -1),
    ("T002","Database Management", "SQL Query Optimization",          "Write optimized SQL queries for given slow queries with EXPLAIN plan.",       9),
    ("T003","Software Engineering","UML Class Diagrams",              "Create class diagrams for a Library Management System.",                     4),
    ("T003","Software Engineering","Agile Sprint Planning",           "Plan a 2-week sprint for a student portal project using Jira.",              12),
]
for tid, subj, title, desc, days_from_today in ASSIGNMENTS:
    dl = str(today + timedelta(days=days_from_today))
    ins("INSERT OR IGNORE INTO assignments (class_id,teacher_id,subject,title,description,deadline) VALUES (?,?,?,?,?,?)",
        (CLASS_ID, tid, subj, title, desc, dl))

# Submissions for past assignments
asgn_rows = sqls(f"SELECT id, teacher_id FROM assignments WHERE class_id={CLASS_ID}")
sub_count = 0
for asgn in asgn_rows:
    aid = asgn[0] if USE_PG else asgn["id"]
    # 8 of 12 students submitted each assignment
    for roll, *_ in STUDENTS[:8]:
        ins("INSERT OR IGNORE INTO submissions (assignment_id,student_roll) VALUES (?,?)", (aid, roll))
        sub_count += 1
print(f"  ✓ {len(ASSIGNMENTS)} assignments, {sub_count} submissions")

# ─────────────────────────────────────────────
# 10. ANNOUNCEMENTS — different priorities per teacher
# ─────────────────────────────────────────────
print("Seeding announcements...")
ANNOUNCEMENTS = [
    ("T001","Data Structures",     "MST2 Syllabus Announced",         "MST2 covers Trees, Graphs, and Dynamic Programming. Practice problems on portal.","high"),
    ("T001","Operating Systems",   "Assignment 2 Deadline Extended",  "Deadline for Process Scheduling extended by 3 days due to student requests.",   "medium"),
    ("T001","Data Structures",     "Extra Class Saturday 9AM",        "Extra doubt-clearing session on Saturday 9-11 AM in Lab 2.",                     "medium"),
    ("T002","Database Management", "Lab Session Rescheduled",         "DB lab moved to Friday 2pm due to server maintenance. Same lab room.",           "high"),
    ("T002","Computer Networks",   "Study Material Uploaded",         "Chapter 4-6 notes and previous year papers uploaded to Notes section.",           "normal"),
    ("T002","Database Management", "Quiz Next Week",                  "5-mark quiz on Normalization and Transactions. Closed book, 20 minutes.",         "high"),
    ("T003","Software Engineering","Guest Lecture on Agile",          "Industry expert from TCS will conduct a guest lecture on Agile & Scrum Friday.",  "high"),
    ("T003","Software Engineering","Project Groups Announced",        "Sprint planning project groups are now live. Check portal for team assignments.", "medium"),
]
for tid, subj, title, body, priority in ANNOUNCEMENTS:
    ins("INSERT OR IGNORE INTO announcements (class_id,teacher_id,subject,title,body,priority) VALUES (?,?,?,?,?,?)",
        (CLASS_ID, tid, subj, title, body, priority))
print(f"  ✓ {len(ANNOUNCEMENTS)} announcements")

# ─────────────────────────────────────────────
# 11. TIMETABLE — realistic schedule Mon-Sat
# ─────────────────────────────────────────────
print("Seeding timetable...")
TIMETABLE = [
    ("T001","Data Structures",      "Monday",    "09:00","10:00","LT-101"),
    ("T002","Database Management",  "Monday",    "11:00","12:00","LT-102"),
    ("T003","Software Engineering", "Monday",    "02:00","03:00","LT-103"),
    ("T001","Operating Systems",    "Tuesday",   "09:00","10:00","LT-101"),
    ("T002","Computer Networks",    "Tuesday",   "11:00","12:00","LT-102"),
    ("T001","Data Structures",      "Wednesday", "10:00","11:00","LT-101"),
    ("T002","Database Management",  "Wednesday", "02:00","03:00","LT-102"),
    ("T001","Operating Systems",    "Thursday",  "09:00","10:00","LT-101"),
    ("T003","Software Engineering", "Thursday",  "11:00","12:00","LT-103"),
    ("T002","Computer Networks",    "Friday",    "09:00","10:00","LT-102"),
    ("T003","Software Engineering", "Friday",    "11:00","12:00","LT-103"),
    ("T001","Data Structures",      "Saturday",  "09:00","10:00","LT-101"),
    ("T002","Database Management",  "Saturday",  "10:00","11:00","LT-102"),
]
for tid, subj, day, st, et, room in TIMETABLE:
    ins("INSERT OR IGNORE INTO timetable (class_id,teacher_id,subject,day,start_time,end_time,room) VALUES (?,?,?,?,?,?,?)",
        (CLASS_ID, tid, subj, day, st, et, room))
print(f"  ✓ {len(TIMETABLE)} timetable slots")

# ─────────────────────────────────────────────
# 12. EXAMS — upcoming
# ─────────────────────────────────────────────
print("Seeding exams...")
EXAMS = [
    ("T001","Data Structures",      "MST2",  str(today+timedelta(days=12)),"10:00","12:00","Hall-A","Trees, Graphs, Hashing, Dynamic Programming"),
    ("T002","Database Management",  "MST2",  str(today+timedelta(days=14)),"02:00","04:00","Hall-B","SQL, Normalization, Transactions, ER Model"),
    ("T001","Operating Systems",    "Quiz",  str(today+timedelta(days=4)), "09:00","10:00","LT-101","Memory Management, Paging, Segmentation"),
    ("T002","Computer Networks",    "MST2",  str(today+timedelta(days=18)),"10:00","12:00","Hall-A","Transport Layer, Application Layer, HTTP"),
    ("T003","Software Engineering", "Final", str(today+timedelta(days=35)),"10:00","01:00","Hall-C","Full Syllabus — all units"),
    ("T003","Software Engineering", "Quiz",  str(today+timedelta(days=6)), "02:00","03:00","LT-103","Agile, Scrum, Sprint Planning"),
]
for tid, subj, etype, edate, st, et, room, syllabus in EXAMS:
    ins("INSERT OR IGNORE INTO exam_timetable (class_id,teacher_id,subject,exam_type,exam_date,start_time,end_time,room,syllabus) VALUES (?,?,?,?,?,?,?,?,?)",
        (CLASS_ID, tid, subj, etype, edate, st, et, room, syllabus))
print(f"  ✓ {len(EXAMS)} exams scheduled")

# ─────────────────────────────────────────────
# 13. TEACHER AVAILABILITY
# ─────────────────────────────────────────────
print("Seeding availability...")
AVAIL = [
    ("T001","Monday",    "11:00","12:00","Room 204","Data Structures doubts only","office"),
    ("T001","Wednesday", "04:00","05:00","Room 204","OS and DS queries","office"),
    ("T001","Friday",    "12:00","01:00","Room 204","Open office hours","office"),
    ("T002","Tuesday",   "01:00","02:00","Room 308","DB doubts only","office"),
    ("T002","Thursday",  "03:00","04:00","Room 308","Networks + DB","office"),
    ("T003","Friday",    "11:00","12:00","Room 112","SE project discussions","office"),
    ("T003","Monday",    "03:00","04:00","Room 112","Agile methodology queries","office"),
]
for tid, day, st, et, loc, note, avtype in AVAIL:
    ins("INSERT OR IGNORE INTO availability (teacher_id,day,start_time,end_time,location,note,avail_type) VALUES (?,?,?,?,?,?,?)",
        (tid, day, st, et, loc, note, avtype))
print(f"  ✓ {len(AVAIL)} availability slots")

# ─────────────────────────────────────────────
# 14. FORUM QUESTIONS + ANSWERS
# ─────────────────────────────────────────────
print("Seeding forum...")
QUESTIONS = [
    ("CS002","Data Structures",    "Difference between AVL and Red-Black Tree?",
     "I understand AVL trees but confused about when to prefer Red-Black. Can someone explain the trade-offs?"),
    ("CS005","Operating Systems",  "Why does Banker's Algorithm avoid deadlock?",
     "Going through deadlock avoidance chapter. Can someone explain the intuition behind Banker's algorithm?"),
    ("CS003","Database Management","Inner Join vs Natural Join — practical difference?",
     "The textbook explanation is confusing. Can someone give a real-world example of when to use each?"),
    ("CS007","Computer Networks",  "How does TCP congestion control work?",
     "Specifically confused about slow start and congestion avoidance phases with diagrams."),
    ("CS009","Software Engineering","What is the difference between Scrum and Kanban?",
     "Both seem similar in Agile. When would you choose one over the other?"),
]
forum_ids = []
for roll, subj, title, body in QUESTIONS:
    qid = ins("INSERT OR IGNORE INTO forum_questions (class_id,student_roll,subject,title,body) VALUES (?,?,?,?,?)",
              (CLASS_ID, roll, subj, title, body))
    if qid: forum_ids.append((qid, subj))

ANSWERS = [
    (0, "T001", "Dr. Arvind Sharma", "teacher",
     "Great question! AVL trees maintain strict balance (height diff ≤ 1), giving O(log n) guaranteed lookups. Red-Black trees allow slight imbalance but have faster insertions/deletions. In practice: use AVL for read-heavy workloads (databases), Red-Black for write-heavy (C++ STL map, Java TreeMap)."),
    (0, "CS004", "Anjali Singh", "student",
     "Adding to sir's answer: Java's TreeMap and C++ std::map both use Red-Black trees internally because they handle frequent insertions well in practice."),
    (2, "T002", "Prof. Meena Joshi", "teacher",
     "Natural Join automatically joins on columns with the same name and removes duplicate columns. Inner Join requires explicit ON condition. Natural Join is cleaner but dangerous — if two unrelated tables share a column name accidentally, you get a wrong result! Always prefer explicit INNER JOIN in production code."),
    (4, "T003", "Dr. Rajesh Kumar", "teacher",
     "Scrum uses fixed-length sprints (1-4 weeks) with defined roles (Scrum Master, Product Owner). Kanban is flow-based with no fixed iterations — work moves through stages continuously. Choose Scrum for new feature development with clear sprint goals; Kanban for support/maintenance work with unpredictable incoming tasks."),
]
for ans_idx, roll, name, role, text in ANSWERS:
    if ans_idx < len(forum_ids):
        qid = forum_ids[ans_idx][0]
        ins("INSERT OR IGNORE INTO forum_answers (question_id,roll_no,responder_name,role,answer) VALUES (?,?,?,?,?)",
            (qid, roll, name, role, text))
        conn.execute("UPDATE forum_questions SET is_ai_answered=0 WHERE id=?", (qid,))
conn.commit()
print(f"  ✓ {len(QUESTIONS)} forum questions + {len(ANSWERS)} answers")

# ─────────────────────────────────────────────
# DONE
# ─────────────────────────────────────────────
print("\n" + "="*60)
print("✅  DEMO SEED v2 COMPLETE!")
print("="*60)
print(f"\n📚 Class:    CSE-A (id={CLASS_ID}) · B.Tech CSE · Sem 4")
print(f"👨‍🎓 Students: {len(STUDENTS)} enrolled")
print(f"📊 Subjects: {len(SUBJECTS)}")
print(f"\n🔑 Login Credentials:")
print(f"  Teachers:")
for roll, name, _ in TEACHERS:
    print(f"    {name:<28} → ID: {roll:<6} | pw: {roll.lower()}")
print(f"  Students:")
for roll, name, *_ in STUDENTS:
    print(f"    {name:<28} → Roll: {roll:<6} | pw: {roll.lower()}")

print(f"\n⚠️  At-Risk Students (deterministic):")
at_risk = {
    "CS005 Vikram Nair":   "Data Structures (62%), Operating Systems (65%)",
    "CS007 Karan Mehta":   "Database Management (58%), Computer Networks (61%)",
    "CS011 Nikhil Joshi":  "Software Engineering (63%)",
}
for stu, detail in at_risk.items():
    print(f"    {stu} → {detail}")
print(f"\n⭐ Top Students: CS010 Pooja (95%+), CS004 Anjali (93%+), CS001 Aarav (86%+)")
print("="*60)

conn.commit()
conn.close()