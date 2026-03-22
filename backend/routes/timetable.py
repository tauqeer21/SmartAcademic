import json
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from db_helpers import fetchall, fetchone, execute

timetable_bp = Blueprint("timetable", __name__)
def cu(): return json.loads(get_jwt_identity())
DAYS=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]

@timetable_bp.route("/", methods=["POST"])
@jwt_required()
def add():
    u=cu()
    if u["role"]!="teacher": return jsonify({"error":"Unauthorized"}),403
    d=request.get_json()
    cid=d.get("class_id"); subj=d.get("subject","").strip()
    day=d.get("day",""); st=d.get("start_time",""); et=d.get("end_time","")
    if not all([cid,subj,day,st,et]): return jsonify({"error":"All fields required"}),400
    tid=execute("INSERT OR IGNORE INTO timetable (class_id,subject,teacher_id,day,start_time,end_time,room) VALUES (?,?,?,?,?,?,?)",
                (cid,subj,u["roll_no"],day,st,et,d.get("room","")))
    return jsonify({"message":"Added"}),201

@timetable_bp.route("/class/<int:cid>", methods=["GET"])
@jwt_required()
def class_tt(cid):
    rows=fetchall("""SELECT t.*,u.name AS teacher_name FROM timetable t
                     JOIN users u ON u.roll_no=t.teacher_id WHERE t.class_id=? ORDER BY t.day,t.start_time""",(cid,))
    grouped={d:[] for d in DAYS}
    for r in rows: grouped.get(r["day"],[]).append(r)
    return jsonify(grouped),200

@timetable_bp.route("/mine", methods=["GET"])
@jwt_required()
def mine():
    u=cu()
    if u["role"]!="student": return jsonify({"error":"Unauthorized"}),403
    rows=fetchall("""SELECT t.*,u.name AS teacher_name,c.name AS class_name
                     FROM timetable t JOIN class_students cs ON cs.class_id=t.class_id
                     JOIN classes c ON c.id=t.class_id
                     JOIN users u ON u.roll_no=t.teacher_id
                     WHERE cs.student_roll=? ORDER BY t.day,t.start_time""",(u["roll_no"],))
    grouped={d:[] for d in DAYS}
    for r in rows: grouped.get(r["day"],[]).append(r)
    return jsonify(grouped),200

@timetable_bp.route("/<int:tid>", methods=["DELETE"])
@jwt_required()
def delete(tid):
    u=cu()
    if u["role"]!="teacher": return jsonify({"error":"Unauthorized"}),403
    execute("DELETE FROM timetable WHERE id=? AND teacher_id=?",(tid,u["roll_no"]))
    return jsonify({"message":"Deleted"}),200
