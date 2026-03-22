import json
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from db_helpers import fetchall, fetchone, execute

availability_bp = Blueprint("availability", __name__)
def cu(): return json.loads(get_jwt_identity())
DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]

@availability_bp.route("/", methods=["POST"])
@jwt_required()
def add():
    u = cu()
    if u["role"] != "teacher": return jsonify({"error":"Unauthorized"}), 403
    d = request.get_json()
    if not d.get("day") or not d.get("start_time") or not d.get("end_time"):
        return jsonify({"error":"day, start_time, end_time required"}), 400
    execute("""INSERT OR IGNORE INTO availability
               (teacher_id,day,start_time,end_time,location,note,period_no,class_name,avail_type)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (u["roll_no"], d["day"], d["start_time"], d["end_time"],
             d.get("location",""), d.get("note",""),
             d.get("period_no",""), d.get("class_name",""),
             d.get("avail_type","office")))
    return jsonify({"message":"Added"}), 201

@availability_bp.route("/teacher/<string:tid>", methods=["GET"])
@jwt_required()
def get_avail(tid):
    u_row = fetchone("SELECT name,gender FROM users WHERE roll_no=?", (tid,))
    rows = fetchall("""SELECT a.* FROM availability a WHERE a.teacher_id=?
                       ORDER BY a.day, a.start_time""", (tid,))
    grouped = {d: [] for d in DAYS}
    for r in rows:
        grouped.get(r["day"], []).append(r)
    return jsonify({
        "schedule": grouped,
        "teacher": u_row or {}
    }), 200

@availability_bp.route("/mine", methods=["GET"])
@jwt_required()
def mine():
    u = cu()
    if u["role"] != "teacher": return jsonify({"error":"Unauthorized"}), 403
    rows = fetchall("SELECT * FROM availability WHERE teacher_id=? ORDER BY day,start_time",
                    (u["roll_no"],))
    grouped = {d: [] for d in DAYS}
    for r in rows:
        grouped.get(r["day"], []).append(r)
    return jsonify(grouped), 200

@availability_bp.route("/<int:aid>", methods=["DELETE"])
@jwt_required()
def delete(aid):
    u = cu()
    if u["role"] != "teacher": return jsonify({"error":"Unauthorized"}), 403
    execute("DELETE FROM availability WHERE id=? AND teacher_id=?", (aid, u["roll_no"]))
    return jsonify({"message":"Deleted"}), 200

@availability_bp.route("/cancel", methods=["POST"])
@jwt_required()
def cancel():
    u = cu()
    if u["role"] != "teacher": return jsonify({"error":"Unauthorized"}), 403
    d = request.get_json()
    if not d.get("class_id") or not d.get("subject") or not d.get("cancelled_date"):
        return jsonify({"error":"class_id, subject, cancelled_date required"}), 400
    execute("INSERT INTO class_cancellations (class_id,teacher_id,subject,cancelled_date,reason,rescheduled_to) VALUES (?,?,?,?,?,?)",
            (d["class_id"], u["roll_no"], d["subject"], d["cancelled_date"],
             d.get("reason",""), d.get("rescheduled_to","")))
    return jsonify({"message":"Cancellation posted"}), 201

@availability_bp.route("/cancellations/<int:cid>", methods=["GET"])
@jwt_required()
def cancellations(cid):
    rows = fetchall("""SELECT cc.*,u.name AS teacher_name FROM class_cancellations cc
                       JOIN users u ON u.roll_no=cc.teacher_id
                       WHERE cc.class_id=? ORDER BY cc.cancelled_date DESC LIMIT 20""", (cid,))
    return jsonify(rows), 200

@availability_bp.route("/all-teachers", methods=["GET"])
@jwt_required()
def all_teachers():
    """Get all teachers with their full schedule — for student view"""
    teachers = fetchall("SELECT roll_no,name,gender FROM users WHERE role='teacher' ORDER BY name")
    result = []
    for t in teachers:
        rows = fetchall("SELECT * FROM availability WHERE teacher_id=? ORDER BY day,start_time", (t["roll_no"],))
        grouped = {d: [] for d in DAYS}
        for r in rows: grouped.get(r["day"],[]).append(r)
        result.append({**t, "schedule": grouped, "has_availability": len(rows) > 0})
    return jsonify(result), 200
