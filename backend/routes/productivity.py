import json
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from db_helpers import fetchall, fetchone, execute
from datetime import date, timedelta

productivity_bp = Blueprint("productivity", __name__)
def cu(): return json.loads(get_jwt_identity())

@productivity_bp.route("/log", methods=["POST"])
@jwt_required()
def log_hours():
    u=cu()
    if u["role"]!="student": return jsonify({"error":"Unauthorized"}),403
    d=request.get_json()
    hrs=float(d.get("hours",0)); dt=d.get("date",str(date.today()))
    if hrs<=0: return jsonify({"error":"Hours must be positive"}),400
    execute("""INSERT INTO study_time (student_roll,date,hours,subject,note) VALUES (?,?,?,?,?)
               ON CONFLICT(student_roll,date) DO UPDATE SET hours=excluded.hours,subject=excluded.subject,note=excluded.note""",
            (u["roll_no"],dt,hrs,d.get("subject",""),d.get("note","")))
    return jsonify({"message":"Logged"}),200

@productivity_bp.route("/mine", methods=["GET"])
@jwt_required()
def my_prod():
    u=cu()
    if u["role"]!="student": return jsonify({"error":"Unauthorized"}),403
    last30=str(date.today()-timedelta(days=30))
    rows=fetchall("SELECT * FROM study_time WHERE student_roll=? AND date>=? ORDER BY date DESC",(u["roll_no"],last30))
    total=sum(r["hours"] for r in rows); avg=round(total/30,2)
    score=min(100,round(avg/8*100,1))
    return jsonify({"logs":rows,"total_hours":round(total,1),"avg_daily":avg,"score":score}),200
