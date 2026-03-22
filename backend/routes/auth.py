import json
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from flask_bcrypt import generate_password_hash, check_password_hash
from db_helpers import fetchone, fetchall, execute

auth_bp = Blueprint("auth", __name__)

def make_token(user):
    identity = json.dumps({
        "roll_no": user["roll_no"], "name": user["name"],
        "role": user["role"], "gender": user.get("gender","male"),
        "course": user.get("course",""), "semester": user.get("semester",""),
    })
    return create_access_token(identity=identity, expires_delta=False)

@auth_bp.route("/login", methods=["POST"])
def login():
    d = request.get_json()
    roll_no  = d.get("roll_no","").strip().upper()
    password = d.get("password","")
    if not roll_no or not password:
        return jsonify({"error":"Roll number and password required"}), 400
    user = fetchone("SELECT * FROM users WHERE roll_no=?", (roll_no,))
    if not user or not check_password_hash(user["password"], password):
        return jsonify({"error":"Invalid credentials"}), 401
    return jsonify({
        "token": make_token(user),
        "user": {"roll_no":user["roll_no"],"name":user["name"],"role":user["role"],
                 "gender":user.get("gender","male"),"course":user.get("course",""),"semester":user.get("semester","")}
    }), 200

@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    return jsonify(json.loads(get_jwt_identity())), 200

@auth_bp.route("/profile", methods=["GET"])
@jwt_required()
def profile():
    cu = json.loads(get_jwt_identity())
    u  = fetchone("SELECT * FROM users WHERE roll_no=?", (cu["roll_no"],))
    if not u: return jsonify({"error": "Not found"}), 404
    # Count classes/subjects
    if u["role"] == "student":
        classes  = fetchall("SELECT c.name, c.id FROM class_students cs JOIN classes c ON c.id=cs.class_id WHERE cs.student_roll=?", (u["roll_no"],))
        subjects = fetchall("SELECT DISTINCT subject FROM attendance WHERE student_roll=?", (u["roll_no"],))
        att      = fetchone("SELECT COUNT(*) as t, SUM(CASE WHEN status='Present' THEN 1 ELSE 0 END) as p FROM attendance WHERE student_roll=?", (u["roll_no"],))
        asgn     = fetchone("SELECT COUNT(*) as c FROM submissions WHERE student_roll=?", (u["roll_no"],))
        att_pct  = round((att["p"] or 0) / att["t"] * 100, 1) if att and att["t"] else 0
        return jsonify({
            "roll_no":    u["roll_no"], "name": u["name"], "role": u["role"],
            "gender":     u["gender"],  "course": u["course"], "semester": u["semester"],
            "phone":      u.get("phone",""), "created_at": u["created_at"],
            "classes":    len(classes), "subjects": len(subjects),
            "attendance_pct": att_pct, "assignments_submitted": asgn["c"] if asgn else 0
        }), 200
    else:
        classes  = fetchall("SELECT DISTINCT c.name FROM class_teachers ct JOIN classes c ON c.id=ct.class_id WHERE ct.teacher_id=?", (u["roll_no"],))
        subjects = fetchall("SELECT DISTINCT subject FROM class_teachers WHERE teacher_id=?", (u["roll_no"],))
        return jsonify({
            "roll_no":   u["roll_no"], "name": u["name"], "role": u["role"],
            "gender":    u["gender"],  "created_at": u["created_at"],
            "classes":   [r["name"] for r in classes],
            "subjects":  [r["subject"] for r in subjects],
        }), 200

@auth_bp.route("/change-password", methods=["POST"])
@jwt_required()
def change_password():
    cu = json.loads(get_jwt_identity())
    d  = request.get_json()
    old = d.get("old_password",""); new = d.get("new_password","")
    if not old or not new or len(new)<6:
        return jsonify({"error":"Old and new password (min 6) required"}), 400
    u = fetchone("SELECT password FROM users WHERE roll_no=?", (cu["roll_no"],))
    if not u or not check_password_hash(u["password"], old):
        return jsonify({"error":"Old password incorrect"}), 400
    execute("UPDATE users SET password=? WHERE roll_no=?",
            (generate_password_hash(new).decode(), cu["roll_no"]))
    return jsonify({"message":"Password changed"}), 200