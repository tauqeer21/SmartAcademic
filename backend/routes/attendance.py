import json, math
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from db_helpers import fetchall, fetchone, execute
from datetime import date

attendance_bp = Blueprint("attendance", __name__)
def cu(): return json.loads(get_jwt_identity())

def bunk_calc(present, total_marked, total_sem):
    """
    Bunk calculator:
    - at_risk   = current attendance % < 75  (are you safe RIGHT NOW?)
    - can_miss  = how many future classes you can skip and stay ≥75% over full semester
    - need_attend = how many consecutive classes you must attend to reach 75% of total_sem

    total_sem    = total lectures planned for semester (from semester_config)
    total_marked = lectures held so far
    present      = lectures attended so far
    """
    total_sem = max(total_sem, total_marked)  # can't be less than what's been held

    # Current percentage — used for at_risk flag
    pct = round(present / total_marked * 100, 1) if total_marked else 0

    # at_risk = currently below 75% (simple and correct)
    at_risk = pct < 75

    # How many total you need to pass the full semester at 75%
    need = math.ceil(0.75 * total_sem)

    # Of remaining classes (total_sem - total_marked), how many can you skip?
    # If you attend all remaining: final_pct = (present + remaining) / total_sem
    # You need final_pct >= 75%, i.e. present + remaining_attended >= need
    # So you can skip: remaining - (need - present) classes
    remaining = max(0, total_sem - total_marked)
    can_miss   = max(0, remaining - max(0, need - present))

    # How many must you attend consecutively to recover to 75% of total_sem?
    need_attend = max(0, need - present)

    return pct, can_miss, need_attend, at_risk, need, total_sem

@attendance_bp.route("/mark", methods=["POST"])
@jwt_required()
def mark():
    u = cu()
    if u["role"] != "teacher": return jsonify({"error": "Unauthorized"}), 403
    d = request.get_json()
    cid = d.get("class_id"); subj = d.get("subject","").strip()
    att_date = d.get("date", str(date.today())); records = d.get("records", [])
    if not cid or not subj or not records:
        return jsonify({"error": "class_id, subject, records required"}), 400
    for r in records:
        execute("""INSERT INTO attendance (class_id,student_roll,subject,date,status,marked_by)
                   VALUES (?,?,?,?,?,?)
                   ON CONFLICT(class_id,student_roll,subject,date) DO UPDATE SET status=excluded.status""",
                (cid, r["roll_no"], subj, att_date, r.get("status","Absent"), u["roll_no"]))

    # Auto-delete attendance alerts for students who just crossed 75%
    try:
        for r in records:
            att = fetchone("""SELECT COUNT(*) as total,
                                     SUM(CASE WHEN status='Present' THEN 1 ELSE 0 END) as present
                              FROM attendance WHERE student_roll=? AND class_id=? AND subject=?""",
                           (r["roll_no"], cid, subj))
            if att and att["total"] and att["total"] > 0:
                pct = (att["present"] or 0) / att["total"] * 100
                if pct >= 75:
                    execute("""DELETE FROM announcements
                                WHERE is_automated=1 AND auto_type='attendance_alert'
                                AND target_roll=? AND class_id=?""",
                            (r["roll_no"], cid))
    except Exception:
        pass

    return jsonify({"message": f"Saved {len(records)} records"}), 200

@attendance_bp.route("/today/<int:cid>", methods=["GET"])
@jwt_required()
def today_att(cid):
    subj = request.args.get("subject",""); att_date = request.args.get("date", str(date.today()))
    q = "SELECT student_roll AS roll_no, status FROM attendance WHERE class_id=? AND date=?"
    p = [cid, att_date]
    if subj: q += " AND subject=?"; p.append(subj)
    return jsonify(fetchall(q, p)), 200

@attendance_bp.route("/history/<int:cid>", methods=["GET"])
@jwt_required()
def history(cid):
    subj = request.args.get("subject","")
    q = """SELECT a.date, a.student_roll AS roll_no, u.name AS student_name, a.status, a.subject
           FROM attendance a JOIN users u ON u.roll_no=a.student_roll WHERE a.class_id=?"""
    p = [cid]
    if subj: q += " AND a.subject=?"; p.append(subj)
    q += " ORDER BY a.date DESC, u.name"
    return jsonify(fetchall(q, p)), 200

@attendance_bp.route("/mine", methods=["GET"])
@jwt_required()
def my_att():
    u = cu()
    if u["role"] != "student": return jsonify({"error": "Unauthorized"}), 403
    rows = fetchall("""
        SELECT a.class_id, a.subject,
               COUNT(*) AS total,
               SUM(CASE WHEN a.status='Present' THEN 1 ELSE 0 END) AS present,
               c.name AS class_name,
               tu.name AS teacher_name
        FROM attendance a
        JOIN classes c ON c.id=a.class_id
        INNER JOIN class_teachers ct ON ct.class_id=a.class_id AND ct.subject=a.subject
        LEFT JOIN users tu ON tu.roll_no=ct.teacher_id
        WHERE a.student_roll=? AND a.class_id IN (SELECT class_id FROM class_students WHERE student_roll=?)
        GROUP BY a.class_id, a.subject
    """, (u["roll_no"], u["roll_no"]))
    result = []
    for row in rows:
        total = row["total"]; present = row["present"]
        cfg = fetchone("SELECT total_lectures FROM semester_config WHERE class_id=? AND subject=?",
                       (row["class_id"], row["subject"]))
        total_sem = cfg["total_lectures"] if cfg and cfg["total_lectures"] else total
        pct, can_miss, need_attend, at_risk, need, total_sem = bunk_calc(present, total, total_sem)
        result.append({**row, "absent": total - present, "percentage": pct,
                       "at_risk": at_risk, "total_lectures_semester": total_sem,
                       "can_miss": can_miss, "need_to_attend": need_attend,
                       "required_total": need})
    return jsonify(result), 200

@attendance_bp.route("/subject-detail", methods=["GET"])
@jwt_required()
def subject_detail():
    u    = cu()
    cid  = request.args.get("class_id")
    subj = request.args.get("subject", "")
    if not cid or not subj: return jsonify({"error": "class_id and subject required"}), 400
    roll = request.args.get("roll_no", u["roll_no"])
    rows = fetchall(
        "SELECT date, status FROM attendance WHERE class_id=? AND student_roll=? AND subject=? ORDER BY date DESC",
        (cid, roll, subj)
    )
    return jsonify(rows), 200

@attendance_bp.route("/semester-config", methods=["POST"])
@jwt_required()
def set_config():
    u = cu()
    if u["role"] != "teacher": return jsonify({"error": "Unauthorized"}), 403
    d = request.get_json()
    execute("""INSERT INTO semester_config (class_id,subject,teacher_id,total_lectures) VALUES (?,?,?,?)
               ON CONFLICT(class_id,subject,teacher_id) DO UPDATE SET total_lectures=excluded.total_lectures""",
            (d["class_id"], d["subject"], u["roll_no"], int(d["total_lectures"])))
    return jsonify({"message": "Saved"}), 200

@attendance_bp.route("/semester-config/<int:cid>", methods=["GET"])
@jwt_required()
def get_config(cid):
    return jsonify(fetchall("SELECT * FROM semester_config WHERE class_id=?", (cid,))), 200

@attendance_bp.route("/summary/<int:cid>", methods=["GET"])
@jwt_required()
def summary(cid):
    subj = request.args.get("subject","")
    q = """SELECT a.student_roll AS roll_no, u.name, u.gender,
                  COUNT(*) AS total,
                  SUM(CASE WHEN a.status='Present' THEN 1 ELSE 0 END) AS present,
                  ROUND(SUM(CASE WHEN a.status='Present' THEN 100.0 ELSE 0 END)/COUNT(*),1) AS percentage
           FROM attendance a
           JOIN users u ON u.roll_no=a.student_roll
           WHERE a.class_id=?"""
    p = [cid]
    if subj: q += " AND a.subject=?"; p.append(subj)
    q += " GROUP BY a.student_roll ORDER BY percentage ASC"
    return jsonify(fetchall(q, p)), 200

@attendance_bp.route("/detained-list", methods=["POST"])
@jwt_required()
def detained_list():
    u = cu()
    if u["role"] != "teacher": return jsonify({"error": "Unauthorized"}), 403
    d         = request.get_json()
    cid       = d.get("class_id")
    threshold = float(d.get("threshold", 75))
    if not cid: return jsonify({"error": "class_id required"}), 400

    records = fetchall("""
        SELECT a.student_roll, u.name AS student_name, a.subject,
               COUNT(*) AS total,
               SUM(CASE WHEN a.status='Present' THEN 1 ELSE 0 END) AS present,
               ROUND(SUM(CASE WHEN a.status='Present' THEN 100.0 ELSE 0 END)/COUNT(*),1) AS pct
        FROM attendance a
        JOIN users u ON u.roll_no=a.student_roll
        INNER JOIN class_teachers ct ON ct.class_id=a.class_id AND ct.subject=a.subject
        WHERE a.class_id=?
        GROUP BY a.student_roll, a.subject
        HAVING COUNT(*) > 0
    """, (cid,))

    student_map = {}
    for r in records:
        roll = r["student_roll"]
        if roll not in student_map:
            student_map[roll] = {"roll_no": roll, "name": r["student_name"], "subjects": []}
        student_map[roll]["subjects"].append({
            "subject": r["subject"], "total": r["total"],
            "present": r["present"], "pct": r["pct"],
            "detained": r["pct"] < threshold
        })

    detained = []; safe = []
    for st in student_map.values():
        det_subjects = [s for s in st["subjects"] if s["detained"]]
        overall_pct  = round(sum(s["pct"] for s in st["subjects"]) / len(st["subjects"]), 1) if st["subjects"] else 0
        entry = {**st, "overall_pct": overall_pct, "detained_in": det_subjects, "detained": len(det_subjects) > 0}
        (detained if entry["detained"] else safe).append(entry)

    detained.sort(key=lambda x: (-len(x["detained_in"]), x["name"]))
    return jsonify({
        "threshold": threshold, "detained": detained, "safe": safe,
        "total_students": len(student_map), "total_detained": len(detained),
    }), 200

@attendance_bp.route("/detained-announce", methods=["POST"])
@jwt_required()
def detained_announce():
    u = cu()
    if u["role"] != "teacher": return jsonify({"error": "Unauthorized"}), 403
    d         = request.get_json()
    cid       = d.get("class_id")
    threshold = float(d.get("threshold", 75))
    detained  = d.get("detained", [])

    sent = 0
    for st in detained:
        subjects_str = ", ".join(s["subject"] for s in st.get("detained_in", []))
        title = "⚠ Detention Notice — Attendance Shortage"
        body  = (
            f"Dear {st['name']},\n\n"
            f"Your attendance is below the required {threshold}% in:\n\n"
            f"  {subjects_str}\n\n"
            f"Students below {threshold}% may NOT be permitted to appear in the upcoming examination "
            f"as per institute regulations.\n\n"
            f"Please contact your subject teacher immediately.\n\n"
            f"— {u['name']} (Teacher)"
        )
        try:
            execute("""INSERT INTO announcements
                       (class_id,teacher_id,subject,title,body,priority,target_roll,auto_type,is_automated)
                       VALUES (?,?,?,?,?,?,?,?,1)""",
                    (cid, u["roll_no"], "", title, body, "high", st["roll_no"], "detention_notice"))
            sent += 1
        except Exception:
            pass

    return jsonify({"message": f"Sent detention notice to {sent} students", "sent": sent}), 200