"""
SmartAcademic Automation Engine
Runs 3 automated jobs:
  1. Attendance Alert   — when student drops below 75%, posts private announcement
  2. Assignment Reminder — 2 days before deadline, reminds students who haven't submitted
  3. (Forum AI auto-answer handled in forum route directly on question post)
"""
import threading, time, logging
from datetime import date, datetime, timedelta
from db_helpers import fetchall, fetchone, execute

log = logging.getLogger("automation")

# ─── HELPER: post a private auto-announcement ──────────────────────────────
def _post_auto_announcement(class_id, target_roll, title, body, auto_type, priority="high"):
    try:
        execute("""INSERT INTO announcements
                   (class_id, teacher_id, subject, title, body, priority, target_roll, auto_type, is_automated)
                   VALUES (?,?,?,?,?,?,?,?,1)""",
                (class_id, "SYSTEM", "", title, body, priority, target_roll, auto_type))
        execute("""INSERT INTO automation_log (auto_type, target_roll, class_id, message)
                   VALUES (?,?,?,?)""", (auto_type, target_roll, class_id, title))
        return True
    except Exception as e:
        log.error(f"Failed to post announcement: {e}")
        return False

# ─── CLEANUP: Delete resolved/expired auto-announcements ─────────────────
def cleanup_auto_announcements():
    """
    Delete auto-announcements when:
    1. Older than 7 days (all auto types)
    2. Attendance alert — student now ≥75% in that subject
    3. Assignment reminder — student has submitted
    """
    deleted = 0

    # 1. Older than 7 days
    n = execute("""DELETE FROM announcements
                   WHERE is_automated=1
                   AND datetime(created_at) < datetime('now', '-7 days')""")
    deleted += (n or 0)

    # 2. Attendance alerts where student is now safe (≥75%)
    alerts = fetchall("""SELECT id, target_roll, class_id FROM announcements
                          WHERE is_automated=1 AND auto_type='attendance_alert'""")
    for a in alerts:
        att = fetchone("""SELECT COUNT(*) as total,
                                 SUM(CASE WHEN status='Present' THEN 1 ELSE 0 END) as present
                          FROM attendance
                          WHERE student_roll=? AND class_id=?""",
                       (a["target_roll"], a["class_id"]))
        if att and att["total"] and att["total"] > 0:
            pct = (att["present"] or 0) / att["total"] * 100
            if pct >= 75:
                execute("DELETE FROM announcements WHERE id=?", (a["id"],))
                deleted += 1

    # 3. Assignment reminders where student has submitted
    reminders = fetchall("""SELECT a.id, a.target_roll, a.title FROM announcements a
                              WHERE a.is_automated=1 AND a.auto_type='assignment_reminder'""")
    for r in reminders:
        # Find the assignment by matching title
        asgn = fetchone("""SELECT id FROM assignments WHERE title=?""",
                        (r["title"].replace("📋 Assignment Due in 2 Days — ", ""),))
        if asgn:
            submitted = fetchone("""SELECT id FROM submissions
                                     WHERE assignment_id=? AND student_roll=?""",
                                 (asgn["id"], r["target_roll"]))
            if submitted:
                execute("DELETE FROM announcements WHERE id=?", (r["id"],))
                deleted += 1

    log.info(f"Cleanup: {deleted} auto-announcements deleted")
    return deleted

# ─── JOB 1: Attendance Alerts ──────────────────────────────────────────────
def run_attendance_alerts(force=False):
    """
    For each student in each subject:
    - If attendance < 75%, post a private alert (once per day max)
    - Message tells them exactly how many classes they need to attend
    """
    log.info("Running attendance alerts...")
    today = str(date.today())

    # All students with their attendance per subject
    records = fetchall("""
        SELECT a.student_roll, a.class_id, a.subject,
               COUNT(*) AS total,
               SUM(CASE WHEN a.status='Present' THEN 1 ELSE 0 END) AS present,
               u.name AS student_name
        FROM attendance a
        JOIN users u ON u.roll_no = a.student_roll
        GROUP BY a.student_roll, a.class_id, a.subject
    """)
    log.info(f"Attendance records found: {len(records)}")

    alerted = 0
    for r in records:
        pct = round((r["present"] or 0) / r["total"] * 100, 1) if r["total"] else 0
        if pct >= 75:
            continue  # Safe — no alert needed

        # Skip dedup check in force/demo mode
        if not force:
            already = fetchone("""SELECT id FROM automation_log
                                  WHERE auto_type='attendance_alert' AND target_roll=?
                                  AND class_id=? AND date(ran_at)=?""",
                               (r["student_roll"], r["class_id"], today))
            if already:
                continue

        # Calculate how many more needed to reach 75%
        need_total = r["total"]
        # 0.75 * (total + x) = present + x  => x = (0.75*total - present) / 0.25
        import math
        must_attend = max(0, math.ceil((0.75 * r["total"] - (r["present"] or 0)) / 0.25))

        title = f"⚠ Attendance Alert — {r['subject']}"
        body  = (
            f"Hi {r['student_name']},\n\n"
            f"Your current attendance in {r['subject']} is {pct}% "
            f"({r['present']}/{r['total']} classes).\n\n"
            f"You need to attend at least {must_attend} more consecutive classes "
            f"to reach the minimum required 75%.\n\n"
            f"Please ensure regular attendance to avoid detention.\n\n"
            f"— SmartAcademic System"
        )
        if _post_auto_announcement(r["class_id"], r["student_roll"], title, body, "attendance_alert"):
            alerted += 1

    log.info(f"Attendance alerts: {alerted} sent")
    return alerted

# ─── JOB 2: Assignment Reminders ───────────────────────────────────────────
def run_assignment_reminders(force=False):
    """
    For each assignment due in exactly 2 days:
    - Find students who haven't submitted yet
    - Post a private reminder announcement to each
    """
    log.info("Running assignment reminders...")
    today      = date.today()
    target_day = str(today + timedelta(days=2))

    assignments = fetchall("""
        SELECT a.*, c.name AS class_name
        FROM assignments a
        JOIN classes c ON c.id = a.class_id
        WHERE a.deadline = ?
    """, (target_day,))

    reminded = 0
    for asgn in assignments:
        # Students enrolled in this class
        students = fetchall("""SELECT u.roll_no, u.name
                               FROM class_students cs JOIN users u ON u.roll_no=cs.student_roll
                               WHERE cs.class_id=?""", (asgn["class_id"],))

        for st in students:
            # Already submitted?
            submitted = fetchone("""SELECT id FROM submissions
                                    WHERE assignment_id=? AND student_roll=?""",
                                 (asgn["id"], st["roll_no"]))
            if submitted:
                continue

            # Already reminded today for this assignment?
            if not force:
                already = fetchone("""SELECT id FROM automation_log
                                      WHERE auto_type='assignment_reminder' AND target_roll=?
                                      AND message LIKE ? AND date(ran_at)=?""",
                                   (st["roll_no"], f"%{asgn['title']}%", str(today)))
                if already:
                    continue

            title = f"📋 Assignment Due in 2 Days — {asgn['title']}"
            body  = (
                f"Hi {st['name']},\n\n"
                f"This is a reminder that your assignment is due in 2 days:\n\n"
                f"📌 Assignment: {asgn['title']}\n"
                f"📚 Subject: {asgn.get('subject','')}\n"
                f"📅 Deadline: {asgn['deadline']}\n"
                f"{('📝 Description: '+asgn['description']) if asgn.get('description') else ''}\n\n"
                f"Please submit before the deadline to avoid a late penalty.\n\n"
                f"— SmartAcademic System"
            )
            if _post_auto_announcement(asgn["class_id"], st["roll_no"], title, body, "assignment_reminder", "high"):
                reminded += 1

    log.info(f"Assignment reminders: {reminded} sent")
    return reminded

# ─── SCHEDULER LOOP ────────────────────────────────────────────────────────
_scheduler_running = False

def _scheduler_loop():
    """Runs in a background thread. Checks time and triggers jobs."""
    global _scheduler_running
    last_run_date = None

    while _scheduler_running:
        now  = datetime.now()
        today = now.date()

        # Run once per day at 7:00 AM (or immediately on first start for demo)
        should_run = (last_run_date != today and now.hour >= 7) or last_run_date is None

        if should_run:
            log.info(f"Automation engine running at {now.strftime('%H:%M')}")
            try:
                cleanup_auto_announcements()
                run_attendance_alerts()
                run_assignment_reminders()
                run_marks_drop_alerts()
            except Exception as e:
                log.error(f"Automation error: {e}")
            last_run_date = today

        time.sleep(60)  # Check every minute

def start_scheduler(app):
    """Start background automation thread within Flask app context"""
    global _scheduler_running
    if _scheduler_running:
        return
    _scheduler_running = True

    def run_with_context():
        with app.app_context():
            _scheduler_loop()

    t = threading.Thread(target=run_with_context, daemon=True, name="AutomationEngine")
    t.start()
    log.info("✓ Automation engine started (background thread)")

def stop_scheduler():
    global _scheduler_running
    _scheduler_running = False

# ─── JOB 3: Marks Drop Alerts ─────────────────────────────────────────────
def run_marks_drop_alerts(force=False):
    """
    If a student scored well in one exam then drops significantly in the next,
    post a private alert encouraging them to seek help.
    Threshold: previous >= 60% AND current <= 50% (drop of 10+ points)
    """
    log.info("Running marks drop alerts...")
    today = str(date.today())

    # Get all students with marks in at least 2 exams per subject
    students = fetchall("SELECT DISTINCT student_roll, class_id, subject FROM marks")

    alerted = 0
    for s in students:
        exams = fetchall("""
            SELECT exam_type, marks_obtained, marks_total,
                   ROUND(CAST(marks_obtained AS FLOAT)/marks_total*100, 1) AS pct
            FROM marks
            WHERE student_roll=? AND class_id=? AND subject=?
              AND marks_total > 0
            ORDER BY
              CASE exam_type
                WHEN 'MST1'  THEN 1
                WHEN 'MST2'  THEN 2
                WHEN 'Final' THEN 3
                ELSE 4 END
        """, (s["student_roll"], s["class_id"], s["subject"]))

        if len(exams) < 2:
            continue

        # Check each consecutive pair
        for i in range(len(exams) - 1):
            prev = exams[i];  curr = exams[i+1]
            prev_pct = prev["pct"] or 0
            curr_pct = curr["pct"] or 0

            if prev_pct >= 60 and curr_pct <= 50 and (prev_pct - curr_pct) >= 10:
                # Significant drop detected
                if not force:
                    already = fetchone("""SELECT id FROM automation_log
                                          WHERE auto_type='marks_drop' AND target_roll=?
                                          AND class_id=? AND message LIKE ?
                                          AND date(ran_at)=?""",
                                       (s["student_roll"], s["class_id"],
                                        f"%{s['subject']}%{curr['exam_type']}%", today))
                    if already:
                        continue

                student = fetchone("SELECT name FROM users WHERE roll_no=?", (s["student_roll"],))
                name = student["name"] if student else s["student_roll"]

                title = f"📉 Marks Drop Detected — {s['subject']} ({curr['exam_type']})"
                body  = (
                    f"Hi {name},\n\n"
                    f"We noticed a significant drop in your {s['subject']} performance:\n\n"
                    f"  {prev['exam_type']}: {prev_pct}%  →  {curr['exam_type']}: {curr_pct}%\n\n"
                    f"A drop of {round(prev_pct - curr_pct, 1)}% has been detected. "
                    f"This may affect your overall grade.\n\n"
                    f"We recommend:\n"
                    f"• Visit your subject teacher during office hours\n"
                    f"• Review {curr['exam_type']} topics you found difficult\n"
                    f"• Reach out to classmates for group study\n\n"
                    f"You can recover — stay consistent!\n\n"
                    f"— SmartAcademic System"
                )
                if _post_auto_announcement(s["class_id"], s["student_roll"], title, body, "marks_drop", "high"):
                    alerted += 1

    log.info(f"Marks drop alerts: {alerted} sent")
    return alerted

# ─── MANUAL TRIGGER endpoint data ─────────────────────────────────────────
def run_all_now():
    """Called from API endpoint to trigger all jobs immediately (for demo/testing)"""
    results = {}
    try: results["cleanup"]              = cleanup_auto_announcements()
    except Exception as e: results["cleanup"] = f"Error: {e}"
    try: results["attendance_alerts"]    = run_attendance_alerts(force=True)
    except Exception as e: results["attendance_alerts"] = f"Error: {e}"
    try: results["assignment_reminders"] = run_assignment_reminders(force=True)
    except Exception as e: results["assignment_reminders"] = f"Error: {e}"
    try: results["marks_drop_alerts"]    = run_marks_drop_alerts(force=True)
    except Exception as e: results["marks_drop_alerts"] = f"Error: {e}"
    return results