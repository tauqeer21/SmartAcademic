import json
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from db_helpers import fetchall, fetchone, execute
from datetime import date

exams_bp = Blueprint("exams", __name__)
def cu(): return json.loads(get_jwt_identity())

@exams_bp.route("/", methods=["POST"])
@jwt_required()
def add():
    u=cu()
    if u["role"]!="teacher": return jsonify({"error":"Unauthorized"}),403
    d=request.get_json()
    cid=d.get("class_id"); subj=d.get("subject","").strip()
    if not all([cid,subj,d.get("exam_date"),d.get("start_time")]):
        return jsonify({"error":"class_id, subject, exam_date, start_time required"}),400
    eid=execute("INSERT INTO exam_timetable (class_id,teacher_id,subject,exam_type,exam_date,start_time,end_time,room,syllabus) VALUES (?,?,?,?,?,?,?,?,?)",
                (cid,u["roll_no"],subj,d.get("exam_type","MST1"),d["exam_date"],d["start_time"],d.get("end_time",""),d.get("room",""),d.get("syllabus","")))
    return jsonify({"id":eid,"message":"Exam added"}),201

@exams_bp.route("/class/<int:cid>", methods=["GET"])
@jwt_required()
def class_exams(cid):
    rows=fetchall("SELECT * FROM exam_timetable WHERE class_id=? ORDER BY exam_date ASC",(cid,))
    today=str(date.today())
    for r in rows:
        r["days_left"]=(date.fromisoformat(r["exam_date"])-date.today()).days
    return jsonify(rows),200

@exams_bp.route("/mine", methods=["GET"])
@jwt_required()
def my_exams():
    u=cu()
    if u["role"]!="student": return jsonify({"error":"Unauthorized"}),403
    rows=fetchall("""SELECT e.*,c.name AS class_name FROM exam_timetable e
                     JOIN class_students cs ON cs.class_id=e.class_id
                     JOIN classes c ON c.id=e.class_id
                     WHERE cs.student_roll=? ORDER BY e.exam_date ASC""",(u["roll_no"],))
    for r in rows:
        r["days_left"]=(date.fromisoformat(r["exam_date"])-date.today()).days
    return jsonify(rows),200

@exams_bp.route("/conflicts/<int:cid>", methods=["GET"])
@jwt_required()
def conflicts(cid):
    rows=fetchall("SELECT * FROM exam_timetable WHERE class_id=? ORDER BY exam_date",(cid,))
    found=[]
    for i in range(len(rows)):
        for j in range(i+1,len(rows)):
            if rows[i]["exam_date"]==rows[j]["exam_date"]:
                found.append({"date":rows[i]["exam_date"],"s1":rows[i]["subject"],"t1":rows[i]["exam_type"],
                              "s2":rows[j]["subject"],"t2":rows[j]["exam_type"]})
    return jsonify(found),200

@exams_bp.route("/<int:eid>", methods=["DELETE"])
@jwt_required()
def delete(eid):
    u=cu()
    if u["role"]!="teacher": return jsonify({"error":"Unauthorized"}),403
    execute("DELETE FROM exam_timetable WHERE id=? AND teacher_id=?",(eid,u["roll_no"]))
    return jsonify({"message":"Deleted"}),200
