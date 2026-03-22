import json, os
from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from db_helpers import fetchall, fetchone, execute
from datetime import date

assignments_bp = Blueprint("assignments", __name__)
def cu(): return json.loads(get_jwt_identity())
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__),'..','uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@assignments_bp.route("/", methods=["POST"])
@jwt_required()
def create():
    u = cu()
    if u["role"] != "teacher": return jsonify({"error": "Unauthorized"}), 403
    title    = request.form.get("title","").strip()
    subj     = request.form.get("subject","").strip()
    cid      = request.form.get("class_id")
    deadline = request.form.get("deadline","")
    desc     = request.form.get("description","")
    if not title or not subj or not cid or not deadline:
        return jsonify({"error": "title, subject, class_id, deadline required"}), 400
    fname = fpath = ""
    if "file" in request.files:
        f = request.files["file"]
        if f and f.filename:
            fname = f.filename
            fpath = os.path.join(UPLOAD_FOLDER, f"asgn_{cid}_{fname}")
            f.save(fpath)
    aid = execute("INSERT INTO assignments (class_id,teacher_id,subject,title,description,deadline,file_name,file_path) VALUES (?,?,?,?,?,?,?,?)",
                  (cid, u["roll_no"], subj, title, desc, deadline, fname, fpath))
    return jsonify({"id": aid, "message": "Created"}), 201

@assignments_bp.route("/class/<int:cid>", methods=["GET"])
@jwt_required()
def class_asgn(cid):
    rows = fetchall("""SELECT a.*, u.name AS teacher_name,
                       (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id=a.id) AS submission_count,
                       (SELECT COUNT(*) FROM class_students cs WHERE cs.class_id=a.class_id) AS total_students,
                       CAST(julianday(a.deadline)-julianday('now') AS INTEGER) AS days_left
                       FROM assignments a JOIN users u ON u.roll_no=a.teacher_id
                       WHERE a.class_id=? ORDER BY a.deadline ASC""", (cid,))
    for r in rows:
        dl = r.get("days_left") or 0
        r["urgency"] = "critical" if dl <= 2 else "high" if dl <= 5 else "normal"
    return jsonify(rows), 200

@assignments_bp.route("/mine", methods=["GET"])
@jwt_required()
def mine():
    u = cu()
    if u["role"] != "student": return jsonify({"error": "Unauthorized"}), 403
    rows = fetchall("""SELECT a.*, u.name AS teacher_name, c.name AS class_name,
                       CAST(julianday(a.deadline)-julianday('now') AS INTEGER) AS days_left,
                       (SELECT id FROM submissions s WHERE s.assignment_id=a.id AND s.student_roll=?) AS sub_id,
                       (SELECT file_name FROM submissions s WHERE s.assignment_id=a.id AND s.student_roll=?) AS sub_file,
                       (SELECT marks_obtained FROM submissions s WHERE s.assignment_id=a.id AND s.student_roll=?) AS sub_marks,
                       (SELECT marks_total FROM submissions s WHERE s.assignment_id=a.id AND s.student_roll=?) AS sub_marks_total
                       FROM assignments a
                       JOIN classes c ON c.id=a.class_id
                       JOIN users u ON u.roll_no=a.teacher_id
                       WHERE a.class_id IN (SELECT class_id FROM class_students WHERE student_roll=?)
                       ORDER BY a.deadline ASC""",
                    (u["roll_no"], u["roll_no"], u["roll_no"], u["roll_no"], u["roll_no"]))
    for r in rows:
        r["submitted"] = bool(r.get("sub_id"))
        dl = r.get("days_left") or 0
        r["urgency"] = "critical" if dl <= 2 else "high" if dl <= 5 else "normal"
    return jsonify(rows), 200

@assignments_bp.route("/<int:aid>/submit", methods=["POST"])
@jwt_required()
def submit(aid):
    u = cu()
    if u["role"] != "student": return jsonify({"error": "Unauthorized"}), 403
    fname = fpath = ""
    if "file" in request.files:
        f = request.files["file"]
        if f and f.filename:
            fname = f.filename
            fpath = os.path.join(UPLOAD_FOLDER, f"sub_{aid}_{u['roll_no']}_{fname}")
            f.save(fpath)
    execute("""INSERT INTO submissions (assignment_id,student_roll,file_name,file_path) VALUES (?,?,?,?)
               ON CONFLICT(assignment_id,student_roll) DO UPDATE
               SET file_path=excluded.file_path, file_name=excluded.file_name, submitted_at=CURRENT_TIMESTAMP""",
            (aid, u["roll_no"], fname, fpath))

    # Instantly delete assignment reminder announcement for this student
    try:
        asgn_info = fetchone("SELECT title, class_id FROM assignments WHERE id=?", (aid,))
        if asgn_info:
            # Delete by title match (both exact and partial)
            execute("""DELETE FROM announcements
                        WHERE is_automated=1 AND auto_type='assignment_reminder'
                        AND target_roll=? AND class_id=?""",
                    (u["roll_no"], asgn_info["class_id"]))
    except Exception:
        pass

    return jsonify({"message": "Submitted"}), 200

@assignments_bp.route("/<int:aid>/submissions", methods=["GET"])
@jwt_required()
def submissions(aid):
    rows = fetchall("""SELECT s.*, u.name AS name, u.roll_no, u.gender
                       FROM submissions s JOIN users u ON u.roll_no=s.student_roll
                       WHERE s.assignment_id=?""", (aid,))
    return jsonify(rows), 200

@assignments_bp.route("/<int:aid>/download", methods=["GET"])
@jwt_required()
def download(aid):
    a = fetchone("SELECT * FROM assignments WHERE id=?", (aid,))
    if not a or not a["file_path"]: return jsonify({"error": "No file attached to this assignment"}), 404
    return send_file(a["file_path"], as_attachment=True, download_name=a["file_name"])

@assignments_bp.route("/<int:aid>", methods=["DELETE"])
@jwt_required()
def delete(aid):
    u = cu()
    if u["role"] != "teacher": return jsonify({"error": "Unauthorized"}), 403
    execute("DELETE FROM submissions WHERE assignment_id=?", (aid,))
    execute("DELETE FROM assignments WHERE id=? AND teacher_id=?", (aid, u["roll_no"]))
    return jsonify({"message": "Deleted"}), 200


@assignments_bp.route("/<int:aid>/grade", methods=["POST"])
@jwt_required()
def grade_submission(aid):
    """Teacher adds marks to a student submission"""
    u = cu()
    if u["role"] != "teacher": return jsonify({"error":"Unauthorized"}), 403
    d = request.get_json()
    roll         = d.get("student_roll")
    marks        = d.get("marks_obtained")
    marks_total  = d.get("marks_total", 10)
    if roll is None or marks is None:
        return jsonify({"error":"student_roll and marks_obtained required"}), 400
    execute("""UPDATE submissions SET marks_obtained=?, marks_total=?
               WHERE assignment_id=? AND student_roll=?""",
            (marks, marks_total, aid, roll))
    return jsonify({"message":"Marks saved"}), 200


@assignments_bp.route("/class/<int:cid>/marks-summary", methods=["GET"])
@jwt_required()
def marks_summary(cid):
    """Get assignment marks summary for all students in a class"""
    u = cu()
    subj = request.args.get("subject","")
    q = """SELECT a.id, a.title, a.subject, a.deadline,
                  s.student_roll, s.marks_obtained, s.marks_total, s.submitted_at,
                  u.name AS student_name
           FROM assignments a
           JOIN submissions s ON s.assignment_id = a.id
           JOIN users u ON u.roll_no = s.student_roll
           WHERE a.class_id=?"""
    p = [cid]
    if subj: q += " AND a.subject=?"; p.append(subj)
    q += " ORDER BY a.deadline DESC, u.name"
    return jsonify(fetchall(q, p)), 200


@assignments_bp.route("/<int:aid>/marks", methods=["POST"])
@jwt_required()
def enter_marks(aid):
    """Teacher enters marks for a submitted assignment"""
    u = cu()
    if u["role"] != "teacher": return jsonify({"error":"Unauthorized"}), 403
    d = request.get_json()
    roll        = d.get("student_roll","")
    marks       = d.get("marks_obtained")
    marks_total = d.get("marks_total", 10)
    if not roll or marks is None: return jsonify({"error":"student_roll and marks_obtained required"}), 400
    execute("""UPDATE submissions SET marks_obtained=?, marks_total=?
               WHERE assignment_id=? AND student_roll=?""",
            (marks, marks_total, aid, roll))
    return jsonify({"message":"Marks saved"}), 200

@assignments_bp.route("/class/<int:cid>/detained", methods=["POST"])
@jwt_required()
def get_detained(cid):
    """Get detained students list based on threshold"""
    u = cu()
    if u["role"] != "teacher": return jsonify({"error":"Unauthorized"}), 403
    d         = request.get_json()
    threshold = float(d.get("threshold", 75))
    subject   = d.get("subject","")  # optional filter

    q = """
        SELECT u.roll_no, u.name, u.gender, a.subject,
               COUNT(*) as total,
               SUM(CASE WHEN a.status='Present' THEN 1 ELSE 0 END) as present,
               ROUND(SUM(CASE WHEN a.status='Present' THEN 100.0 ELSE 0 END)/COUNT(*),1) as pct
        FROM attendance a JOIN users u ON u.roll_no=a.student_roll
        WHERE a.class_id=?
    """
    params = [cid]
    if subject:
        q += " AND a.subject=?"; params.append(subject)
    q += " GROUP BY a.student_roll, a.subject HAVING pct < ? ORDER BY pct ASC"
    params.append(threshold)

    detained = fetchall(q, params)
    # Group by student
    by_student = {}
    for r in detained:
        roll = r["roll_no"]
        if roll not in by_student:
            by_student[roll] = {"roll_no":roll,"name":r["name"],"gender":r["gender"],"subjects":[]}
        by_student[roll]["subjects"].append({"subject":r["subject"],"pct":r["pct"],"present":r["present"],"total":r["total"]})

    result = list(by_student.values())
    # Sort by worst attendance
    result.sort(key=lambda x: min(s["pct"] for s in x["subjects"]))
    return jsonify({"threshold":threshold,"count":len(result),"students":result}), 200

@assignments_bp.route("/class/<int:cid>/detained/announce", methods=["POST"])
@jwt_required()
def announce_detained(cid):
    """Send detention notice to entire class"""
    u = cu()
    if u["role"] != "teacher": return jsonify({"error":"Unauthorized"}), 403
    d         = request.get_json()
    threshold = float(d.get("threshold", 75))
    students  = d.get("students", [])  # list of {roll_no, name, subjects}
    exam_type = d.get("exam_type","Upcoming Examination")

    # Post one class-wide announcement
    cls = fetchone("SELECT name FROM classes WHERE id=?", (cid,))
    cls_name = cls["name"] if cls else "Class"
    count = len(students)
    title = f"⚠ Detention Notice — {exam_type}"
    body  = (
        "Dear Students,\n\n"
        f"The following {count} student(s) have attendance below {threshold}% and may not be "
        f"permitted to appear in the {exam_type}:\n\n"
    )
    for st in students:
        subj_list = ", ".join(f"{s['subject']} ({s['pct']}%)" for s in st["subjects"])
        body += f"• {st['name']} ({st['roll_no']}) — {subj_list}\n"
    body += (
        "\nStudents are advised to meet the subject teacher immediately "
        "to discuss their attendance status.\n\n"
        f"— {cls_name} Administration"
    )
    execute("""INSERT INTO announcements
               (class_id,teacher_id,subject,title,body,priority,is_automated,auto_type)
               VALUES (?,?,?,?,?,?,0,'')""",
            (cid, u["roll_no"],"",title,body,"high"))

    # Also send individual private notice to each detained student
    for st in students:
        subj_detail = "\n".join(f"  - {s['subject']}: {s['present']}/{s['total']} classes ({s['pct']}%)" for s in st["subjects"])
        ind_body = (
            f"Dear {st['name']},\n\n"
            f"Your attendance is below the required {threshold}% in the following subjects:\n\n"
            f"{subj_detail}\n\n"
            f"You may not be permitted to appear in the {exam_type} if attendance is not improved immediately.\n"
            f"Please meet your teacher as soon as possible.\n\n"
            f"— {cls_name} Administration"
        )
        execute("""INSERT INTO announcements
                   (class_id,teacher_id,subject,title,body,priority,target_roll,is_automated,auto_type)
                   VALUES (?,?,?,?,?,?,?,0,'')""",
                (cid,u["roll_no"],"",f"⚠ Personal Detention Notice — {st['name']}",ind_body,"high",st["roll_no"]))

    execute("INSERT INTO detained_lists (class_id,teacher_id,threshold,sent) VALUES (?,?,?,1)",
            (cid, u["roll_no"], threshold))
    return jsonify({"message":f"Detention notice sent to {count} students"}), 200