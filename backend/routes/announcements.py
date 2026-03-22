import json
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from db_helpers import fetchall, fetchone, execute

announcements_bp = Blueprint("announcements", __name__)
def cu(): return json.loads(get_jwt_identity())

@announcements_bp.route("/", methods=["POST"])
@jwt_required()
def post():
    u = cu()
    if u["role"] != "teacher": return jsonify({"error": "Unauthorized"}), 403
    d = request.get_json()
    cid = d.get("class_id"); title = d.get("title","").strip()
    if not cid or not title: return jsonify({"error": "class_id and title required"}), 400
    aid = execute(
        "INSERT INTO announcements (class_id,teacher_id,subject,title,body,priority) VALUES (?,?,?,?,?,?)",
        (cid, u["roll_no"], d.get("subject",""), title, d.get("body",""), d.get("priority","normal"))
    )
    return jsonify({"id": aid, "message": "Posted"}), 201

@announcements_bp.route("/class/<int:cid>", methods=["GET"])
@jwt_required()
def class_ann(cid):
    rows = fetchall("""
        SELECT a.*, COALESCE(u.name, 'System') AS teacher_name
        FROM announcements a
        LEFT JOIN users u ON u.roll_no = a.teacher_id
        WHERE a.class_id = ? AND (a.target_roll IS NULL OR a.target_roll = '')
        ORDER BY a.created_at DESC LIMIT 30
    """, (cid,))
    return jsonify(rows), 200

@announcements_bp.route("/mine", methods=["GET"])
@jwt_required()
def mine():
    u = cu()
    if u["role"] != "student": return jsonify({"error": "Unauthorized"}), 403
    # LEFT JOIN so SYSTEM announcements (teacher_id='SYSTEM') don't fail
    rows = fetchall("""
        SELECT a.*, 
               COALESCE(u.name, 'SmartAcademic System') AS teacher_name,
               c.name AS class_name
        FROM announcements a
        JOIN class_students cs ON cs.class_id = a.class_id
        JOIN classes c ON c.id = a.class_id
        LEFT JOIN users u ON u.roll_no = a.teacher_id
        WHERE cs.student_roll = ?
          AND (
            a.target_roll IS NULL 
            OR a.target_roll = ''
            OR a.target_roll = ?
          )
        ORDER BY a.created_at DESC LIMIT 30
    """, (u["roll_no"], u["roll_no"]))
    return jsonify(rows), 200

@announcements_bp.route("/clear-auto-for-me", methods=["DELETE"])
@jwt_required()
def clear_auto():
    u = cu()
    if u["role"] != "student": return jsonify({"error": "Unauthorized"}), 403
    execute(
        "DELETE FROM announcements WHERE is_automated=1 AND target_roll=?",
        (u["roll_no"],)
    )
    return jsonify({"message": "Cleared"}), 200

@announcements_bp.route("/<int:aid>", methods=["DELETE"])
@jwt_required()
def delete(aid):
    u = cu()
    if u["role"] != "teacher": return jsonify({"error": "Unauthorized"}), 403
    execute("DELETE FROM announcements WHERE id=? AND teacher_id=?", (aid, u["roll_no"]))
    return jsonify({"message": "Deleted"}), 200