import json
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from db_helpers import fetchall, fetchone, execute

marks_bp = Blueprint("marks", __name__)
def cu(): return json.loads(get_jwt_identity())
def grade(p): return "O" if p>=90 else "A+" if p>=80 else "A" if p>=70 else "B+" if p>=60 else "B" if p>=50 else "C" if p>=40 else "F"

# Frontend posts to /marks/ (with slash) based on MarksEntry.jsx
@marks_bp.route("/", methods=["POST"])
@marks_bp.route("/save", methods=["POST"])
@jwt_required()
def save():
    u=cu()
    if u["role"]!="teacher": return jsonify({"error":"Unauthorized"}),403
    d=request.get_json()
    cid=d.get("class_id"); subj=d.get("subject","").strip()
    exam_type=d.get("exam_type",""); entries=d.get("entries",[])
    if not cid or not subj or not entries: return jsonify({"error":"class_id,subject,entries required"}),400
    for e in entries:
        execute("""INSERT INTO marks (class_id,student_roll,subject,exam_type,marks_obtained,marks_total,entered_by)
                   VALUES (?,?,?,?,?,?,?)
                   ON CONFLICT(class_id,student_roll,subject,exam_type)
                   DO UPDATE SET marks_obtained=excluded.marks_obtained,marks_total=excluded.marks_total""",
                (cid,e["roll_no"],subj,exam_type,float(e.get("marks_obtained",0)),float(e.get("marks_total",30)),u["roll_no"]))
    return jsonify({"message":f"Saved for {len(entries)} students"}),200

@marks_bp.route("/class/<int:cid>", methods=["GET"])
@jwt_required()
def class_marks(cid):
    subj=request.args.get("subject","")
    q="""SELECT m.*,u.name AS student_name,u.gender
         FROM marks m JOIN users u ON u.roll_no=m.student_roll
         WHERE m.class_id=?"""
    p=[cid]
    if subj: q+=" AND m.subject=?"; p.append(subj)
    q+=" ORDER BY m.subject,m.exam_type,u.name"
    rows=fetchall(q,p)
    for r in rows:
        pct=round(r["marks_obtained"]/r["marks_total"]*100,1) if r["marks_total"] else 0
        r["percentage"]=pct; r["grade"]=grade(pct)
    return jsonify(rows),200

@marks_bp.route("/mine", methods=["GET"])
@jwt_required()
def mine():
    u=cu()
    if u["role"]!="student": return jsonify({"error":"Unauthorized"}),403
    rows=fetchall("""SELECT m.*,c.name AS class_name,tu.name AS teacher_name
                     FROM marks m JOIN classes c ON c.id=m.class_id
                     LEFT JOIN users tu ON tu.roll_no=m.entered_by
                     WHERE m.student_roll=? ORDER BY m.subject,m.exam_type""",(u["roll_no"],))
    for r in rows:
        pct=round(r["marks_obtained"]/r["marks_total"]*100,1) if r["marks_total"] else 0
        r["percentage"]=pct; r["grade"]=grade(pct)
    return jsonify(rows),200
