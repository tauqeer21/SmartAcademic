import json, math
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from db_helpers import fetchall, fetchone, execute
from datetime import date, timedelta
from collections import defaultdict

analytics_bp = Blueprint("analytics", __name__)
def cu(): return json.loads(get_jwt_identity())
def grade(p): return "O" if p>=90 else "A+" if p>=80 else "A" if p>=70 else "B+" if p>=60 else "B" if p>=50 else "C" if p>=40 else "F"

# ─── TEACHER DASHBOARD ───────────────────────────────────────────────────────
@analytics_bp.route("/teacher-dashboard", methods=["GET"])
@jwt_required()
def teacher_dash():
    u = cu()
    if u["role"] != "teacher": return jsonify({"error": "Unauthorized"}), 403
    cid = request.args.get("class_id")
    total_students = at_risk = 0; avg_att = 0.0

    if cid:
        cid = int(cid)
        # Only this teacher's subjects
        teacher_subjects = fetchall(
            "SELECT subject FROM class_teachers WHERE class_id=? AND teacher_id=?",
            (cid, u["roll_no"])
        )
        my_subjects = [r["subject"] for r in teacher_subjects]
        placeholders = ','.join(['?' for _ in my_subjects]) if my_subjects else "''"

        students = fetchall("SELECT student_roll FROM class_students WHERE class_id=?", (cid,))
        total_students = len(students)

        for s in students:
            if my_subjects:
                row = fetchone(
                    f"SELECT COUNT(*) AS t, SUM(CASE WHEN status='Present' THEN 1 ELSE 0 END) AS p "
                    f"FROM attendance WHERE class_id=? AND student_roll=? AND subject IN ({placeholders})",
                    (cid, s["student_roll"], *my_subjects)
                )
            else:
                row = fetchone(
                    "SELECT COUNT(*) AS t, SUM(CASE WHEN status='Present' THEN 1 ELSE 0 END) AS p "
                    "FROM attendance WHERE class_id=? AND student_roll=?",
                    (cid, s["student_roll"])
                )
            if row and row["t"] and (row["p"] or 0) / row["t"] * 100 < 75:
                at_risk += 1

        if my_subjects:
            avg_row = fetchone(
                f"SELECT AVG(CASE WHEN status='Present' THEN 100.0 ELSE 0 END) AS avg "
                f"FROM attendance WHERE class_id=? AND subject IN ({placeholders})",
                (cid, *my_subjects)
            )
        else:
            avg_row = fetchone(
                "SELECT AVG(CASE WHEN status='Present' THEN 100.0 ELSE 0 END) AS avg "
                "FROM attendance WHERE class_id=?", (cid,)
            )
        avg_att = round(avg_row["avg"] or 0, 1)

    active  = fetchone("SELECT COUNT(*) AS c FROM assignments WHERE teacher_id=? AND deadline>=date('now')", (u["roll_no"],))["c"]
    my_cls  = fetchone("SELECT COUNT(DISTINCT id) AS c FROM classes WHERE created_by=?", (u["roll_no"],))["c"]
    papers  = fetchone("SELECT COUNT(*) AS c FROM question_papers WHERE teacher_id=?", (u["roll_no"],))["c"]
    return jsonify({"total_students": total_students, "at_risk": at_risk,
                    "avg_attendance": avg_att, "active_assignments": active,
                    "my_classes": my_cls, "papers_generated": papers}), 200


# ─── DETENTION ALERTS ────────────────────────────────────────────────────────
@analytics_bp.route("/detention-alerts/<int:cid>", methods=["GET"])
@jwt_required()
def detention(cid):
    u = cu()
    # Filter by teacher's subjects if teacher
    if u["role"] == "teacher":
        teacher_subjects = fetchall(
            "SELECT subject FROM class_teachers WHERE class_id=? AND teacher_id=?",
            (cid, u["roll_no"])
        )
        my_subjects = [r["subject"] for r in teacher_subjects]
    else:
        my_subjects = []

    students = fetchall(
        "SELECT u.roll_no,u.name,u.gender FROM class_students cs "
        "JOIN users u ON u.roll_no=cs.student_roll WHERE cs.class_id=?", (cid,)
    )
    alerts = []
    for s in students:
        if my_subjects:
            placeholders = ','.join(['?' for _ in my_subjects])
            row = fetchone(
                f"SELECT COUNT(*) AS t, SUM(CASE WHEN status='Present' THEN 1 ELSE 0 END) AS p "
                f"FROM attendance WHERE class_id=? AND student_roll=? AND subject IN ({placeholders})",
                (cid, s["roll_no"], *my_subjects)
            )
        else:
            row = fetchone(
                "SELECT COUNT(*) AS t, SUM(CASE WHEN status='Present' THEN 1 ELSE 0 END) AS p "
                "FROM attendance WHERE class_id=? AND student_roll=?",
                (cid, s["roll_no"])
            )
        if not row or not row["t"]: continue
        pct = round((row["p"] or 0) / row["t"] * 100, 1)
        if pct < 75:
            need = max(0, math.ceil((0.75 * row["t"] - (row["p"] or 0)) / 0.25))
            risk = _compute_risk(s["roll_no"], cid)
            alerts.append({**s, "percentage": pct,
                           "severity": "critical" if pct < 60 else "warning",
                           "classes_needed": need, "risk_level": risk["risk_level"]})
    return jsonify(sorted(alerts, key=lambda x: x["percentage"])), 200


# ─── RISK COMPUTATION ────────────────────────────────────────────────────────
def _compute_risk(roll, cid):
    today = date.today()

    def att_in_range(start, end):
        r = fetchone(
            "SELECT COUNT(*) AS t, SUM(CASE WHEN status='Present' THEN 1 ELSE 0 END) AS p "
            "FROM attendance WHERE student_roll=? AND class_id=? AND date BETWEEN ? AND ?",
            (roll, cid, str(start), str(end))
        )
        return round((r["p"] or 0) / r["t"] * 100, 1) if r and r["t"] else None

    all_dates = fetchall(
        "SELECT DISTINCT date FROM attendance WHERE student_roll=? AND class_id=? ORDER BY date ASC",
        (roll, cid)
    )
    att_trend = 0; recent_att = prev_att = None
    if len(all_dates) >= 2:
        dates = [r["date"] for r in all_dates]
        mid   = len(dates) // 2
        prev_start, prev_end     = dates[0],   dates[mid-1]
        recent_start, recent_end = dates[mid], dates[-1]
        recent_att = att_in_range(recent_start, recent_end)
        prev_att   = att_in_range(prev_start,   prev_end)
        if recent_att is not None and prev_att is not None:
            att_trend = round(recent_att - prev_att, 1)

    all_marks = fetchall(
        "SELECT marks_obtained, marks_total, created_at FROM marks "
        "WHERE student_roll=? AND class_id=? ORDER BY created_at ASC",
        (roll, cid)
    )
    marks_trend = 0
    if len(all_marks) >= 2:
        first_pct = (all_marks[0]["marks_obtained"] or 0) / (all_marks[0]["marks_total"] or 1) * 100
        last_pct  = (all_marks[-1]["marks_obtained"] or 0) / (all_marks[-1]["marks_total"] or 1) * 100
        marks_trend = last_pct - first_pct

    total_asgn = fetchone("SELECT COUNT(*) AS c FROM assignments WHERE class_id=?", (cid,))["c"]
    submitted  = fetchone(
        "SELECT COUNT(*) AS c FROM submissions s JOIN assignments a ON a.id=s.assignment_id "
        "WHERE s.student_roll=? AND a.class_id=?", (roll, cid)
    )["c"]
    asgn_rate  = submitted / total_asgn * 100 if total_asgn else 100
    forum_q    = fetchone("SELECT COUNT(*) AS c FROM forum_questions WHERE student_roll=? AND class_id=?", (roll, cid))["c"]
    prod       = fetchone("SELECT COALESCE(AVG(hours),0) AS avg FROM study_time WHERE student_roll=? AND date>=date('now','-14 days')", (roll,))
    prod_score = min(100, (prod["avg"] or 0) / 6 * 100)
    engagement = round((asgn_rate * 0.5 + min(100, forum_q * 20) * 0.2 + prod_score * 0.3), 1)

    current_att = att_in_range(today - timedelta(days=60), today) or 75
    risk_score  = 0
    risk_score += (75 - min(75, current_att)) * 0.4
    risk_score += max(0, -att_trend)          * 0.25
    risk_score += max(0, -marks_trend)        * 0.15
    risk_score += (100 - engagement)          * 0.2
    risk_score  = round(min(100, risk_score), 1)
    level = "critical" if risk_score >= 60 else "high" if risk_score >= 40 else "medium" if risk_score >= 20 else "low"

    return {"risk_score": risk_score, "risk_level": level,
            "att_trend": att_trend, "marks_trend": marks_trend,
            "engagement_score": engagement,
            "att_3weeks": recent_att, "att_prev3weeks": prev_att}


# ─── STUDENT RISK PROFILE ────────────────────────────────────────────────────
@analytics_bp.route("/student-risk/<string:roll>", methods=["GET"])
@jwt_required()
def student_risk(roll):
    cid = request.args.get("class_id")
    if not cid: return jsonify({"error": "class_id required"}), 400
    return jsonify(_compute_risk(roll, int(cid))), 200


# ─── ATTENDANCE TREND (weekly) ───────────────────────────────────────────────
@analytics_bp.route("/attendance-trend/<string:roll>", methods=["GET"])
@jwt_required()
def att_trend(roll):
    cid  = request.args.get("class_id")
    subj = request.args.get("subject", "")
    weeks = []
    for i in range(8, -1, -1):
        wend   = date.today() - timedelta(days=i*7)
        wstart = wend - timedelta(days=6)
        q = ("SELECT COUNT(*) AS t, SUM(CASE WHEN status='Present' THEN 1 ELSE 0 END) AS p "
             "FROM attendance WHERE student_roll=? AND date BETWEEN ? AND ?")
        p = [roll, str(wstart), str(wend)]
        if cid:  q += " AND class_id=?"; p.append(int(cid))
        if subj: q += " AND subject=?";  p.append(subj)
        r = fetchone(q, p)
        pct = round((r["p"] or 0) / r["t"] * 100, 1) if r and r["t"] else None
        weeks.append({"week": str(wstart), "week_end": str(wend),
                      "total": r["t"] if r else 0, "present": r["p"] if r else 0,
                      "percentage": pct})
    return jsonify(weeks), 200


# ─── MARKS TREND ─────────────────────────────────────────────────────────────
@analytics_bp.route("/marks-trend/<string:roll>", methods=["GET"])
@jwt_required()
def marks_trend_api(roll):
    cid = request.args.get("class_id")
    q = ("SELECT m.subject, m.exam_type, m.marks_obtained, m.marks_total, "
         "ROUND(m.marks_obtained*100.0/NULLIF(m.marks_total,0),1) AS percentage, m.created_at "
         "FROM marks m WHERE m.student_roll=?")
    p = [roll]
    if cid: q += " AND m.class_id=?"; p.append(int(cid))
    q += " ORDER BY m.subject, m.created_at"
    rows = fetchall(q, p)
    by_subj = {}
    for r in rows:
        s = r["subject"]
        if s not in by_subj: by_subj[s] = []
        by_subj[s].append(r)
    result = {}
    for s, ms in by_subj.items():
        if len(ms) >= 2:
            trend = (ms[-1]["percentage"] or 0) - (ms[0]["percentage"] or 0)
            result[s] = {"exams": ms, "trend": round(trend, 1),
                         "improving": trend > 0, "declining": trend < -5}
        else:
            result[s] = {"exams": ms, "trend": 0, "improving": False, "declining": False}
    return jsonify(result), 200


# ─── CLASS-WIDE RISK REPORT ───────────────────────────────────────────────────
@analytics_bp.route("/class-risk/<int:cid>", methods=["GET"])
@jwt_required()
def class_risk(cid):
    students = fetchall(
        "SELECT u.roll_no,u.name,u.gender FROM class_students cs "
        "JOIN users u ON u.roll_no=cs.student_roll WHERE cs.class_id=?", (cid,)
    )
    result = []
    for s in students:
        risk = _compute_risk(s["roll_no"], cid)
        att  = fetchone(
            "SELECT COUNT(*) AS t, SUM(CASE WHEN status='Present' THEN 1 ELSE 0 END) AS p "
            "FROM attendance WHERE class_id=? AND student_roll=?", (cid, s["roll_no"])
        )
        pct = round((att["p"] or 0) / att["t"] * 100, 1) if att and att["t"] else 0
        result.append({**s, **risk, "attendance": pct})
    return jsonify(sorted(result, key=lambda x: -x["risk_score"])), 200


# ─── WORKING DAYS HELPER ─────────────────────────────────────────────────────
def _working_days(start, end):
    count = 0
    cur = start
    while cur < end:
        if cur.weekday() < 5: count += 1
        cur += timedelta(days=1)
    return count


# ─── SMART ATTENDANCE TARGETS ────────────────────────────────────────────────
@analytics_bp.route("/attendance-targets/<string:roll>", methods=["GET"])
@jwt_required()
def att_targets(roll):
    classes = fetchall("SELECT class_id FROM class_students WHERE student_roll=?", (roll,))
    targets = []
    today   = date.today()

    for cls in classes:
        cid = cls["class_id"]
        subjects = fetchall(
            "SELECT DISTINCT subject FROM attendance WHERE student_roll=? AND class_id=? "
            "UNION SELECT DISTINCT subject FROM class_teachers WHERE class_id=? "
            "UNION SELECT DISTINCT subject FROM exam_timetable WHERE class_id=?",
            (roll, cid, cid, cid)
        )
        for subj_row in subjects:
            subj = subj_row["subject"]
            curr = fetchone(
                "SELECT COUNT(*) AS total, SUM(CASE WHEN status='Present' THEN 1 ELSE 0 END) AS present "
                "FROM attendance WHERE student_roll=? AND class_id=? AND subject=?",
                (roll, cid, subj)
            )
            cfg       = fetchone("SELECT total_lectures FROM semester_config WHERE class_id=? AND subject=?", (cid, subj))
            total_sem = cfg["total_lectures"] if cfg and cfg["total_lectures"] else None
            cur_total = curr["total"]   if curr else 0
            cur_pres  = curr["present"] if curr else 0

            # Use exam_timetable instead of exam_dates
            exams = fetchall(
                "SELECT * FROM exam_timetable WHERE class_id=? AND subject=? ORDER BY exam_date",
                (cid, subj)
            )
            exam_targets = []
            for exam in exams:
                exam_dt   = date.fromisoformat(exam["exam_date"])
                days_left = (exam_dt - today).days
                status    = "upcoming" if days_left >= 0 else "completed"
                if status == "completed":
                    exam_targets.append({
                        "exam_type": exam["exam_type"], "exam_date": exam["exam_date"],
                        "days_left": days_left, "status": "completed",
                        "lecs_remaining":0,"total_by_exam":cur_total,"need_by_exam":0,
                        "must_attend_before_exam":0,"can_miss_before_exam":0,
                        "projected_if_attend_all":0,"projected_if_skip_all":0,
                    })
                    continue
                tomorrow = today + timedelta(days=1)
                lecs_remaining = _working_days(tomorrow, exam_dt)
                total_by_exam  = cur_total + lecs_remaining
                if total_sem:
                    total_by_exam  = min(total_by_exam, total_sem)
                    lecs_remaining = max(0, total_by_exam - cur_total)
                need_by_exam  = math.ceil(0.75 * total_by_exam)
                must_attend   = max(0, need_by_exam - cur_pres)
                can_miss      = max(0, lecs_remaining - must_attend)
                proj_if_all   = round((cur_pres + lecs_remaining) / total_by_exam * 100, 1) if total_by_exam else 0
                proj_if_none  = round(cur_pres / total_by_exam * 100, 1) if total_by_exam else 0
                exam_targets.append({
                    "exam_type": exam["exam_type"], "exam_date": exam["exam_date"],
                    "days_left": days_left, "status": "upcoming",
                    "lecs_remaining": lecs_remaining, "total_by_exam": total_by_exam,
                    "present_so_far": cur_pres, "need_by_exam": need_by_exam,
                    "must_attend_before_exam": must_attend, "can_miss_before_exam": can_miss,
                    "projected_if_attend_all": proj_if_all, "projected_if_skip_all": proj_if_none,
                })
            class_info = fetchone("SELECT name FROM classes WHERE id=?", (cid,))
            targets.append({
                "subject": subj, "class_id": cid,
                "class_name": class_info["name"] if class_info else "",
                "current_present": cur_pres, "current_total": cur_total,
                "current_pct": round(cur_pres / cur_total * 100, 1) if cur_total else 0,
                "total_sem": total_sem or cur_total,
                "exam_targets": exam_targets,
            })
    return jsonify(targets), 200


# ─── FULL REPORT ─────────────────────────────────────────────────────────────
@analytics_bp.route("/report/<string:roll>", methods=["GET"])
@jwt_required()
def report(roll):
    u = cu()
    if u["role"] == "student" and u["roll_no"] != roll:
        return jsonify({"error": "Unauthorized"}), 403
    student = fetchone("SELECT * FROM users WHERE roll_no=?", (roll,))
    if not student: return jsonify({"error": "Not found"}), 404

    att_data = fetchall(
        "SELECT subject, class_id, COUNT(*) AS total, "
        "SUM(CASE WHEN status='Present' THEN 1 ELSE 0 END) AS present "
        "FROM attendance WHERE student_roll=? GROUP BY class_id,subject", (roll,)
    )
    for a in att_data:
        a["percentage"] = round((a["present"] or 0) / a["total"] * 100, 1) if a["total"] else 0
        a["at_risk"] = a["percentage"] < 75
    tot_att  = sum(a["total"]   for a in att_data)
    tot_pres = sum(a["present"] for a in att_data)
    overall_att = round(tot_pres / tot_att * 100, 1) if tot_att else 0

    marks_raw = fetchall(
        "SELECT m.*, c.name AS class_name FROM marks m JOIN classes c ON c.id=m.class_id "
        "WHERE m.student_roll=? ORDER BY m.subject, m.exam_type", (roll,)
    )
    subj_marks = defaultdict(dict)
    for m in marks_raw:
        pct = round((m["marks_obtained"] or 0) / m["marks_total"] * 100, 1) if m["marks_total"] else 0
        m["percentage"] = pct
        m["grade"] = grade(pct)
        subj_marks[m["subject"]][m["exam_type"]] = m

    subject_summaries = []
    for subj, exams in subj_marks.items():
        mst1  = exams.get("MST1")
        mst2  = exams.get("MST2")
        final = exams.get("Final")
        mst_entries = [e for e in [mst1, mst2] if e and e["marks_obtained"] is not None]
        if mst_entries:
            mst_pcts  = [round(e["marks_obtained"]/e["marks_total"]*100,1) for e in mst_entries if e["marks_total"]]
            mst_avg_pct = round(sum(mst_pcts)/len(mst_pcts), 1) if mst_pcts else None
            mst_total = mst_entries[0]["marks_total"]
            mst_avg   = round(sum(e["marks_obtained"] for e in mst_entries)/len(mst_entries), 1)
        else:
            mst_avg = mst_avg_pct = mst_total = None
        asgn_marks = fetchall(
            "SELECT s.marks_obtained, s.marks_total, a.title FROM submissions s "
            "JOIN assignments a ON a.id=s.assignment_id "
            "WHERE s.student_roll=? AND a.subject=? AND s.marks_obtained IS NOT NULL",
            (roll, subj)
        )
        asgn_avg = round(sum((s["marks_obtained"] or 0) for s in asgn_marks)/len(asgn_marks),1) if asgn_marks else None
        internal = None
        if mst_avg is not None and asgn_avg is not None: internal = round(mst_avg + asgn_avg, 1)
        elif mst_avg is not None: internal = mst_avg
        subject_summaries.append({
            "subject": subj, "mst1": mst1, "mst2": mst2, "final": final,
            "mst_avg": mst_avg, "mst_pct": mst_avg_pct,
            "mst_total": mst_total if mst_total else 24,
            "assignment_avg": asgn_avg, "internal_total": internal,
            "final_marks": final["marks_obtained"] if final else None,
            "final_total": final["marks_total"] if final else 60,
        })

    classes  = fetchall("SELECT class_id FROM class_students WHERE student_roll=?", (roll,))
    tot_asgn = submitted = 0
    all_asgn_marks = []
    for cls in classes:
        tot_asgn += fetchone("SELECT COUNT(*) AS c FROM assignments WHERE class_id=?", (cls["class_id"],))["c"]
        subs = fetchall(
            "SELECT s.marks_obtained, s.marks_total FROM submissions s "
            "JOIN assignments a ON a.id=s.assignment_id "
            "WHERE s.student_roll=? AND a.class_id=?", (roll, cls["class_id"])
        )
        submitted += len(subs)
        all_asgn_marks += [s for s in subs if s["marks_obtained"] is not None]
    asgn_rate    = round(submitted / tot_asgn * 100, 1) if tot_asgn else 0
    asgn_avg_all = round(sum((s["marks_obtained"] or 0) for s in all_asgn_marks)/len(all_asgn_marks),1) if all_asgn_marks else None

    all_mst = [s["mst_avg"] for s in subject_summaries if s["mst_avg"] is not None]
    overall_mst = round(sum(all_mst)/len(all_mst), 1) if all_mst else 0
    marks_pct   = round(overall_mst/24*100, 1) if overall_mst else 0
    overall     = round(overall_att * 0.3 + asgn_rate * 0.2 + marks_pct * 0.5, 1)

    return jsonify({
        "student":               dict(student),
        "generated_at":          str(date.today()),
        "attendance_by_subject": att_data,
        "attendance":            {"total":tot_att,"present":tot_pres,"percentage":overall_att,"at_risk":overall_att<75},
        "assignments":           {"total":tot_asgn,"submitted":submitted,"rate":asgn_rate,"avg_marks":asgn_avg_all},
        "marks":                 marks_raw,
        "subject_summaries":     subject_summaries,
        "overall_mst_avg":       overall_mst,
        "marks_percentage":      marks_pct,
        "overall":               overall,
        "grade":                 grade(overall),
        "productivity":          {"total_hours":0,"avg_daily":0,"score":0},
        "total_obtained":        sum((m["marks_obtained"] or 0) for m in marks_raw),
        "total_max":             sum((m["marks_total"] or 0) for m in marks_raw),
    }), 200


# ─── CSV EXPORTS ─────────────────────────────────────────────────────────────
@analytics_bp.route("/export/attendance/<int:cid>", methods=["GET"])
@jwt_required()
def export_attendance(cid):
    import csv, io
    from flask import Response
    u = cu()
    if u["role"] != "teacher": return jsonify({"error":"Unauthorized"}),403
    cls = fetchone("SELECT * FROM classes WHERE id=?", (cid,))
    if not cls: return jsonify({"error":"Not found"}),404
    students = fetchall(
        "SELECT u.roll_no,u.name FROM class_students cs "
        "JOIN users u ON u.roll_no=cs.student_roll WHERE cs.class_id=? ORDER BY u.name", (cid,)
    )
    # Only teacher's subjects
    subjects = fetchall(
        "SELECT DISTINCT subject FROM attendance WHERE class_id=? AND subject IN "
        "(SELECT subject FROM class_teachers WHERE class_id=? AND teacher_id=?) ORDER BY subject",
        (cid, cid, u["roll_no"])
    )
    subj_list = [s["subject"] for s in subjects]
    output = io.StringIO(); w = csv.writer(output)
    w.writerow(["Roll No","Name"] + subj_list + ["Overall %"])
    for st in students:
        row = [st["roll_no"], st["name"]]
        totals = []
        for subj in subj_list:
            att = fetchone(
                "SELECT COUNT(*) AS t, SUM(CASE WHEN status='Present' THEN 1 ELSE 0 END) AS p "
                "FROM attendance WHERE class_id=? AND student_roll=? AND subject=?",
                (cid, st["roll_no"], subj)
            )
            pct = round((att["p"] or 0)/att["t"]*100,1) if att and att["t"] else 0
            row.append(f"{att['p'] or 0}/{att['t'] or 0} ({pct}%)")
            totals.append(pct)
        row.append(f"{round(sum(totals)/len(totals),1) if totals else 0}%")
        w.writerow(row)
    return Response(output.getvalue(), mimetype="text/csv",
                    headers={"Content-Disposition":f'attachment; filename="attendance_{cls["name"]}.csv"'})


@analytics_bp.route("/export/marks/<int:cid>", methods=["GET"])
@jwt_required()
def export_marks(cid):
    import csv, io
    from flask import Response
    u = cu()
    if u["role"] != "teacher": return jsonify({"error":"Unauthorized"}),403
    cls = fetchone("SELECT * FROM classes WHERE id=?", (cid,))
    if not cls: return jsonify({"error":"Not found"}),404
    students = fetchall(
        "SELECT u.roll_no,u.name FROM class_students cs "
        "JOIN users u ON u.roll_no=cs.student_roll WHERE cs.class_id=? ORDER BY u.name", (cid,)
    )
    exams = fetchall(
        "SELECT DISTINCT subject,exam_type FROM marks "
        "WHERE class_id=? AND subject IN (SELECT subject FROM class_teachers WHERE class_id=? AND teacher_id=?) "
        "ORDER BY subject,exam_type",
        (cid, cid, u["roll_no"])
    )
    headers = [f"{e['subject']} ({e['exam_type']})" for e in exams]
    output = io.StringIO(); w = csv.writer(output)
    w.writerow(["Roll No","Name"] + headers)
    for st in students:
        row = [st["roll_no"], st["name"]]
        for e in exams:
            m = fetchone(
                "SELECT marks_obtained,marks_total FROM marks "
                "WHERE class_id=? AND student_roll=? AND subject=? AND exam_type=?",
                (cid, st["roll_no"], e["subject"], e["exam_type"])
            )
            if m and m["marks_total"]:
                pct = round(m["marks_obtained"]/m["marks_total"]*100,1)
                row.append(f"{int(m['marks_obtained'])}/{int(m['marks_total'])} ({grade(pct)})")
            else:
                row.append("—")
        w.writerow(row)
    return Response(output.getvalue(), mimetype="text/csv",
                    headers={"Content-Disposition":f'attachment; filename="marks_{cls["name"]}.csv"'})


# ─── STUDENT CONTEXT FOR AI ──────────────────────────────────────────────────
@analytics_bp.route("/student-context/<string:roll>", methods=["GET"])
@jwt_required()
def student_context(roll):
    u = cu()
    if u["role"] != "student" or u["roll_no"] != roll:
        return jsonify({"error":"Unauthorized"}),403
    att = fetchall(
        "SELECT a.subject,a.class_id,c.name AS class_name, COUNT(*) AS total, "
        "SUM(CASE WHEN a.status='Present' THEN 1 ELSE 0 END) AS present, "
        "ROUND(SUM(CASE WHEN a.status='Present' THEN 1 ELSE 0 END)*100.0/COUNT(*),1) AS pct "
        "FROM attendance a JOIN classes c ON c.id=a.class_id WHERE a.student_roll=? "
        "GROUP BY a.subject,a.class_id", (roll,)
    )
    marks = fetchall(
        "SELECT subject,exam_type,marks_obtained,marks_total, "
        "ROUND(marks_obtained*100.0/NULLIF(marks_total,0),1) AS pct "
        "FROM marks WHERE student_roll=? ORDER BY subject,exam_type", (roll,)
    )
    classes = fetchall("SELECT class_id FROM class_students WHERE student_roll=?", (roll,))
    exams = []
    for cls in classes:
        eds = fetchall(
            "SELECT subject,exam_type,exam_date, "
            "CAST(julianday(exam_date)-julianday('now') AS INTEGER) AS days_left "
            "FROM exam_timetable WHERE class_id=? AND exam_date>=date('now') ORDER BY exam_date",
            (cls["class_id"],)
        )
        exams.extend(eds)
    pending = fetchall(
        "SELECT a.subject,a.title,a.deadline FROM assignments a "
        "WHERE a.class_id IN (SELECT class_id FROM class_students WHERE student_roll=?) "
        "AND a.id NOT IN (SELECT assignment_id FROM submissions WHERE student_roll=?) "
        "AND a.deadline>=date('now') ORDER BY a.deadline",
        (roll, roll)
    )
    return jsonify({"attendance":att,"marks":marks,"exams":exams,"pending_assignments":pending}),200