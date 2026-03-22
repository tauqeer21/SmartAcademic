import json
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from flask_bcrypt import generate_password_hash
from db_helpers import fetchall, fetchone, execute

classes_bp = Blueprint("classes", __name__)
def cu(): return json.loads(get_jwt_identity())

@classes_bp.route("/", methods=["POST"])
@jwt_required()
def create_class():
    u = cu()
    if u["role"] != "teacher": return jsonify({"error":"Unauthorized"}), 403
    d = request.get_json()
    name = d.get("name","").strip()
    if not name: return jsonify({"error":"Class name required"}), 400
    cid = execute(
        "INSERT INTO classes (name,section,semester,course,created_by) VALUES (?,?,?,?,?)",
        (name, d.get("section",""), d.get("semester",""), d.get("course",""), u["roll_no"])
    )
    if d.get("subject"):
        execute("INSERT OR IGNORE INTO class_teachers (class_id,teacher_id,subject) VALUES (?,?,?)",
                (cid, u["roll_no"], d["subject"]))
    return jsonify({"id": cid, "message": "Class created"}), 201

@classes_bp.route("/<int:cid>/subjects", methods=["POST"])
@jwt_required()
def add_subject(cid):
    u = cu()
    if u["role"] != "teacher": return jsonify({"error":"Unauthorized"}), 403
    subj = request.get_json().get("subject","").strip()
    if not subj: return jsonify({"error":"Subject required"}), 400
    execute("INSERT OR IGNORE INTO class_teachers (class_id,teacher_id,subject) VALUES (?,?,?)",
            (cid, u["roll_no"], subj))
    return jsonify({"message":"Subject added"}), 201

@classes_bp.route("/<int:cid>/subjects/<string:subj>", methods=["DELETE"])
@jwt_required()
def delete_subject(cid, subj):
    u = cu()
    if u["role"] != "teacher": return jsonify({"error":"Unauthorized"}), 403
    execute("DELETE FROM class_teachers WHERE class_id=? AND teacher_id=? AND subject=?",
            (cid, u["roll_no"], subj))
    return jsonify({"message":"Removed"}), 200

@classes_bp.route("/<int:cid>/students", methods=["POST"])
@jwt_required()
def enroll_student(cid):
    u = cu()
    if u["role"] != "teacher": return jsonify({"error":"Unauthorized"}), 403
    d = request.get_json()
    roll     = d.get("roll_no","").strip().upper()
    name     = d.get("name","").strip()
    gender   = d.get("gender","male")
    course   = d.get("course","")
    semester = d.get("semester","")
    phone    = d.get("phone","")
    # Custom password — if not provided, default to roll_no lowercase
    password = d.get("password","").strip() or roll.lower()

    if not roll or not name: return jsonify({"error":"roll_no and name required"}), 400

    existing = fetchone("SELECT id FROM users WHERE roll_no=?", (roll,))
    if existing:
        # Update info if student already exists (e.g. re-enrolled in another class)
        execute("UPDATE users SET name=?,gender=?,course=?,semester=?,phone=? WHERE roll_no=?",
                (name, gender, course, semester, phone, roll))
    else:
        pw = generate_password_hash(password).decode()
        execute("INSERT INTO users (roll_no,name,password,role,gender,course,semester,phone) VALUES (?,?,?,?,?,?,?,?)",
                (roll, name, pw, "student", gender, course, semester, phone))

    # Add to class (ignore if already enrolled)
    try:
        execute("INSERT INTO class_students (class_id,student_roll) VALUES (?,?)", (cid, roll))
    except: pass

    return jsonify({"message": f"{name} enrolled"}), 201

@classes_bp.route("/<int:cid>/students/<string:roll>", methods=["DELETE"])
@jwt_required()
def remove_student(cid, roll):
    u = cu()
    if u["role"] != "teacher": return jsonify({"error":"Unauthorized"}), 403
    execute("DELETE FROM class_students WHERE class_id=? AND student_roll=?", (cid, roll))
    return jsonify({"message":"Removed"}), 200

@classes_bp.route("/my", methods=["GET"])
@jwt_required()
def my_classes():
    u = cu()
    if u["role"] == "teacher":
        # Teacher sees ALL classes where they teach at least one subject
        # (created by them OR assigned as subject teacher)
        rows = fetchall("""
            SELECT DISTINCT c.*,
                   GROUP_CONCAT(ct2.subject, ', ') AS subjects
            FROM classes c
            INNER JOIN class_teachers ct ON ct.class_id = c.id AND ct.teacher_id = ?
            LEFT JOIN class_teachers ct2 ON ct2.class_id = c.id AND ct2.teacher_id = ?
            GROUP BY c.id ORDER BY c.created_at DESC
        """, (u["roll_no"], u["roll_no"]))
        for r in rows:
            r["student_count"] = fetchone(
                "SELECT COUNT(*) AS cnt FROM class_students WHERE class_id=?", (r["id"],))["cnt"]
    else:
        # Student: get all classes — LEFT JOIN class_teachers so classes without subjects still appear
        rows = fetchall("""
            SELECT DISTINCT c.id, c.name, c.section, c.semester, c.course,
                   ct.subject, ct.teacher_id,
                   tu.name AS teacher_name, tu.gender AS teacher_gender
            FROM class_students cs
            JOIN classes c ON c.id = cs.class_id
            LEFT JOIN class_teachers ct ON ct.class_id = c.id
            LEFT JOIN users tu ON tu.roll_no = ct.teacher_id
            WHERE cs.student_roll = ?
            ORDER BY c.name, ct.subject
        """, (u["roll_no"],))
    return jsonify(rows), 200

@classes_bp.route("/<int:cid>/students", methods=["GET"])
@jwt_required()
def get_students(cid):
    rows = fetchall("""
        SELECT u.roll_no, u.name, u.gender, u.course, u.semester, u.phone
        FROM class_students cs
        JOIN users u ON u.roll_no = cs.student_roll
        WHERE cs.class_id = ? ORDER BY u.name
    """, (cid,))
    return jsonify(rows), 200

@classes_bp.route("/<int:cid>/my-subjects", methods=["GET"])
@jwt_required()
def my_subjects(cid):
    u = cu()
    rows = fetchall("SELECT subject FROM class_teachers WHERE class_id=? AND teacher_id=?",
                    (cid, u["roll_no"]))
    return jsonify([r["subject"] for r in rows]), 200

@classes_bp.route("/<int:cid>/teachers", methods=["GET"])
@jwt_required()
def get_teachers(cid):
    rows = fetchall("""
        SELECT ct.subject, ct.teacher_id, u.name AS teacher_name, u.gender
        FROM class_teachers ct JOIN users u ON u.roll_no = ct.teacher_id
        WHERE ct.class_id = ? ORDER BY ct.subject
    """, (cid,))
    return jsonify(rows), 200

@classes_bp.route("/<int:cid>", methods=["DELETE"])
@jwt_required()
def delete_class(cid):
    u = cu()
    if u["role"] != "teacher": return jsonify({"error":"Unauthorized"}), 403
    cls = fetchone("SELECT * FROM classes WHERE id=? AND created_by=?", (cid, u["roll_no"]))
    if not cls: return jsonify({"error":"Not found or unauthorized"}), 404
    execute("DELETE FROM classes WHERE id=?", (cid,))
    return jsonify({"message":"Class deleted"}), 200

@classes_bp.route("/<int:cid>", methods=["PUT"])
@jwt_required()
def update_class(cid):
    u = cu()
    if u["role"] != "teacher": return jsonify({"error":"Unauthorized"}), 403
    d = request.get_json()
    execute("UPDATE classes SET name=?,section=?,semester=?,course=? WHERE id=? AND created_by=?",
            (d.get("name",""), d.get("section",""), d.get("semester",""),
             d.get("course",""), cid, u["roll_no"]))
    return jsonify({"message":"Updated"}), 200