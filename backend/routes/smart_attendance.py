import json, base64, os, numpy as np
from datetime import date
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from db_helpers import fetchall, fetchone, execute

smart_bp = Blueprint("smart", __name__)
def cu(): return json.loads(get_jwt_identity())

# ── face_recognition is optional — graceful fallback if not installed ──────
try:
    import face_recognition
    FR_AVAILABLE = True
except ImportError:
    FR_AVAILABLE = False

def _load_encoding(enc_str):
    """Deserialise stored face encoding from JSON string"""
    if not enc_str: return None
    try: return np.array(json.loads(enc_str))
    except: return None

def _encode_image_b64(b64_str):
    """Decode base64 image and return face_recognition image array"""
    if not FR_AVAILABLE: return None, "face_recognition not installed — run: pip install face_recognition"
    try:
        # Strip data URL prefix if present
        if ',' in b64_str:
            b64_str = b64_str.split(',')[1]
        img_bytes = base64.b64decode(b64_str)
        import io
        from PIL import Image
        img = Image.open(io.BytesIO(img_bytes)).convert('RGB')
        return face_recognition.load_image_file(io.BytesIO(img_bytes)), None
    except Exception as e:
        return None, str(e)

# ── UPLOAD STUDENT PHOTO + REGISTER FACE ──────────────────────────────────
@smart_bp.route("/register-face", methods=["POST"])
@jwt_required()
def register_face():
    """Teacher uploads a student photo — system encodes and stores the face"""
    u = cu()
    if u["role"] != "teacher":
        return jsonify({"error": "Unauthorized"}), 403
    d = request.get_json()
    roll    = d.get("roll_no", "").strip()
    b64_img = d.get("image_b64", "")
    if not roll or not b64_img:
        return jsonify({"error": "roll_no and image_b64 required"}), 400
    student = fetchone("SELECT * FROM users WHERE roll_no=?", (roll,))
    if not student:
        return jsonify({"error": "Student not found"}), 404

    if not FR_AVAILABLE:
        # Store photo path only, no encoding
        photo_path = f"face_{roll}.jpg"
        img_bytes  = base64.b64decode(b64_img.split(',')[1] if ',' in b64_img else b64_img)
        full_path  = os.path.join(current_app.config["UPLOAD_FOLDER"], photo_path)
        with open(full_path, 'wb') as f:
            f.write(img_bytes)
        execute("UPDATE users SET photo_path=? WHERE roll_no=?", (photo_path, roll))
        return jsonify({"message": "Photo saved (face_recognition not installed — encoding skipped)", "has_encoding": False}), 200

    img, err = _encode_image_b64(b64_img)
    if err: return jsonify({"error": err}), 400

    encs = face_recognition.face_encodings(img)
    if not encs:
        return jsonify({"error": "No face detected in the photo. Use a clear front-facing photo."}), 400
    if len(encs) > 1:
        return jsonify({"error": "Multiple faces detected. Use a photo with only the student."}), 400

    # Save photo file
    photo_path = f"face_{roll}.jpg"
    img_bytes  = base64.b64decode(b64_img.split(',')[1] if ',' in b64_img else b64_img)
    with open(os.path.join(current_app.config["UPLOAD_FOLDER"], photo_path), 'wb') as f:
        f.write(img_bytes)

    enc_json = json.dumps(encs[0].tolist())
    execute("UPDATE users SET photo_path=?, face_encoding=? WHERE roll_no=?",
            (photo_path, enc_json, roll))
    return jsonify({"message": f"Face registered for {student['name']}", "has_encoding": True}), 200

# ── SESSION MANAGEMENT ─────────────────────────────────────────────────────
@smart_bp.route("/session/start", methods=["POST"])
@jwt_required()
def start_session():
    u = cu()
    if u["role"] != "teacher": return jsonify({"error": "Unauthorized"}), 403
    d   = request.get_json()
    cid = d.get("class_id"); subj = d.get("subject","").strip()
    if not cid or not subj: return jsonify({"error": "class_id and subject required"}), 400

    today = str(date.today())
    # Close any existing active session for this class/subject/date
    execute("""UPDATE smart_sessions SET status='ended', ended_at=CURRENT_TIMESTAMP
               WHERE class_id=? AND subject=? AND date=? AND status='active'""",
            (cid, subj, today))

    sid = execute("""INSERT INTO smart_sessions (class_id, teacher_id, subject, date)
                     VALUES (?,?,?,?)""", (cid, u["roll_no"], subj, today))
    return jsonify({"session_id": sid, "message": "Session started"}), 200

@smart_bp.route("/session/end", methods=["POST"])
@jwt_required()
def end_session():
    u = cu()
    if u["role"] != "teacher": return jsonify({"error": "Unauthorized"}), 403
    d   = request.get_json()
    sid = d.get("session_id"); cid = d.get("class_id"); subj = d.get("subject","").strip()
    if not sid: return jsonify({"error": "session_id required"}), 400

    execute("""UPDATE smart_sessions SET status='ended', ended_at=CURRENT_TIMESTAMP
               WHERE id=? AND teacher_id=?""", (sid, u["roll_no"]))

    # Lock attendance for this session
    today = str(date.today())
    try:
        execute("""INSERT OR IGNORE INTO attendance_locks (class_id, subject, date, locked_by, session_id)
                   VALUES (?,?,?,?,?)""", (cid, subj, today, u["roll_no"], sid))
    except: pass

    # Summary
    session = fetchone("SELECT * FROM smart_sessions WHERE id=?", (sid,))
    att = fetchall("""SELECT status, COUNT(*) as cnt FROM attendance
                      WHERE class_id=? AND subject=? AND date=?
                      GROUP BY status""", (cid, subj, today))
    present = next((r["cnt"] for r in att if r["status"]=="Present"), 0)
    absent  = next((r["cnt"] for r in att if r["status"]=="Absent"),  0)
    return jsonify({
        "message": "Session ended and attendance locked",
        "summary": {"present": present, "absent": absent,
                     "total": present+absent, "detected": session["total_detected"] if session else 0}
    }), 200

@smart_bp.route("/session/active", methods=["GET"])
@jwt_required()
def active_session():
    u = cu()
    cid  = request.args.get("class_id"); subj = request.args.get("subject","")
    today = str(date.today())
    s = fetchone("""SELECT * FROM smart_sessions
                    WHERE class_id=? AND subject=? AND date=? AND status='active'
                    ORDER BY id DESC LIMIT 1""", (cid, subj, today))
    return jsonify(s or {}), 200

# ── PROCESS FRAME ──────────────────────────────────────────────────────────
@smart_bp.route("/process-frame", methods=["POST"])
@jwt_required()
def process_frame():
    """
    Receives a base64 frame, detects faces, matches against enrolled students,
    marks them Present in attendance table, returns bounding boxes + names.
    """
    u = cu()
    if u["role"] != "teacher": return jsonify({"error": "Unauthorized"}), 403
    d    = request.get_json()
    b64  = d.get("frame_b64","")
    cid  = d.get("class_id"); subj = d.get("subject","").strip(); sid = d.get("session_id")
    if not all([b64, cid, subj]): return jsonify({"error": "frame_b64, class_id, subject required"}), 400

    if not FR_AVAILABLE:
        return jsonify({"error": "face_recognition not installed on server. Run: pip install face_recognition",
                        "detections": []}), 200

    # Load all enrolled students with face encodings
    students = fetchall("""SELECT u.roll_no, u.name, u.face_encoding
                           FROM class_students cs JOIN users u ON u.roll_no=cs.student_roll
                           WHERE cs.class_id=? AND u.face_encoding != '' AND u.face_encoding IS NOT NULL""",
                        (cid,))
    if not students:
        return jsonify({"message": "No students with registered faces in this class",
                        "detections": []}), 200

    known_encs   = []
    known_rolls  = []
    known_names  = []
    for st in students:
        enc = _load_encoding(st["face_encoding"])
        if enc is not None:
            known_encs.append(enc)
            known_rolls.append(st["roll_no"])
            known_names.append(st["name"])

    # Decode and process frame
    img, err = _encode_image_b64(b64)
    if err: return jsonify({"error": err, "detections": []}), 200

    # Detect faces in frame — use small model for speed
    face_locs  = face_recognition.face_locations(img, model="hog")
    face_encs  = face_recognition.face_encodings(img, face_locs)

    today      = str(date.today())
    detections = []
    detected_count = 0

    for face_enc, face_loc in zip(face_encs, face_locs):
        top, right, bottom, left = face_loc
        match_name  = "Unknown"
        match_roll  = None
        confidence  = 0
        status      = "unknown"

        if known_encs:
            distances = face_recognition.face_distance(known_encs, face_enc)
            best_idx  = int(np.argmin(distances))
            best_dist = float(distances[best_idx])
            confidence = round((1 - best_dist) * 100, 1)

            if best_dist < 0.5:  # threshold — lower = stricter
                match_name = known_names[best_idx]
                match_roll = known_rolls[best_idx]
                status     = "present"
                detected_count += 1

                # Check if already marked today
                existing = fetchone("""SELECT status FROM attendance
                                       WHERE class_id=? AND student_roll=? AND subject=? AND date=?""",
                                    (cid, match_roll, subj, today))
                if not existing:
                    execute("""INSERT INTO attendance (class_id, student_roll, subject, date, status, marked_by)
                               VALUES (?,?,?,?,?,?)""",
                            (cid, match_roll, subj, today, "Present", u["roll_no"]))
                elif existing["status"] == "Absent":
                    # Was marked absent — update to present (camera overrides)
                    execute("""UPDATE attendance SET status='Present', marked_by=?
                               WHERE class_id=? AND student_roll=? AND subject=? AND date=?""",
                            (u["roll_no"], cid, match_roll, subj, today))

        detections.append({
            "box":        {"top": top, "right": right, "bottom": bottom, "left": left},
            "name":       match_name,
            "roll_no":    match_roll,
            "confidence": confidence,
            "status":     status
        })

    # Update session detected count
    if sid:
        execute("""UPDATE smart_sessions SET total_detected=total_detected+?
                   WHERE id=?""", (detected_count, sid))

    # Mark absent: enrolled students NOT detected in any frame this session
    # Only mark absent at session END, not during — handled by end_session trigger
    return jsonify({
        "detections":      detections,
        "faces_found":     len(face_locs),
        "faces_matched":   detected_count,
        "frame_processed": True
    }), 200

# ── MARK ABSENT at session end ─────────────────────────────────────────────
@smart_bp.route("/finalize-absent", methods=["POST"])
@jwt_required()
def finalize_absent():
    """Mark all students NOT present today as Absent"""
    u = cu()
    if u["role"] != "teacher": return jsonify({"error": "Unauthorized"}), 403
    d    = request.get_json()
    cid  = d.get("class_id"); subj = d.get("subject","").strip()
    today = str(date.today())
    students = fetchall("""SELECT u.roll_no FROM class_students cs
                           JOIN users u ON u.roll_no=cs.student_roll
                           WHERE cs.class_id=?""", (cid,))
    marked_absent = 0
    for st in students:
        existing = fetchone("""SELECT id FROM attendance
                               WHERE class_id=? AND student_roll=? AND subject=? AND date=?""",
                            (cid, st["roll_no"], subj, today))
        if not existing:
            execute("""INSERT INTO attendance (class_id, student_roll, subject, date, status, marked_by)
                       VALUES (?,?,?,?,?,?)""",
                    (cid, st["roll_no"], subj, today, "Absent", u["roll_no"]))
            marked_absent += 1
    return jsonify({"marked_absent": marked_absent}), 200

# ── MANUAL CORRECTION with audit ──────────────────────────────────────────
@smart_bp.route("/manual-correct", methods=["POST"])
@jwt_required()
def manual_correct():
    """Teacher manually changes attendance after session — creates audit log"""
    u = cu()
    if u["role"] != "teacher": return jsonify({"error": "Unauthorized"}), 403
    d      = request.get_json()
    cid    = d.get("class_id"); subj = d.get("subject","").strip()
    roll   = d.get("roll_no"); new_status = d.get("status")
    today  = d.get("date", str(date.today()))
    reason = d.get("reason", "manual_correction")
    if not all([cid, subj, roll, new_status]): return jsonify({"error": "Missing fields"}), 400

    existing = fetchone("""SELECT status FROM attendance
                           WHERE class_id=? AND student_roll=? AND subject=? AND date=?""",
                        (cid, roll, subj, today))
    old_status = existing["status"] if existing else None

    if existing:
        execute("""UPDATE attendance SET status=?, marked_by=?
                   WHERE class_id=? AND student_roll=? AND subject=? AND date=?""",
                (new_status, u["roll_no"], cid, roll, subj, today))
    else:
        execute("""INSERT INTO attendance (class_id, student_roll, subject, date, status, marked_by)
                   VALUES (?,?,?,?,?,?)""", (cid, roll, subj, today, new_status, u["roll_no"]))

    # Audit log
    execute("""INSERT INTO attendance_audit (class_id, subject, date, student_roll, old_status, new_status, changed_by, reason)
               VALUES (?,?,?,?,?,?,?,?)""",
            (cid, subj, today, roll, old_status, new_status, u["roll_no"], reason))

    return jsonify({"message": f"Updated to {new_status}", "audited": True}), 200

# ── GET SESSION ATTENDANCE (for live view) ─────────────────────────────────
@smart_bp.route("/session-attendance", methods=["GET"])
@jwt_required()
def session_attendance():
    cid  = request.args.get("class_id"); subj = request.args.get("subject","")
    today = str(date.today())
    students = fetchall("""SELECT u.roll_no, u.name, u.gender,
                                  COALESCE(a.status, 'Pending') as status
                           FROM class_students cs
                           JOIN users u ON u.roll_no=cs.student_roll
                           LEFT JOIN attendance a ON a.student_roll=cs.student_roll
                               AND a.class_id=cs.class_id AND a.subject=? AND a.date=?
                           WHERE cs.class_id=?
                           ORDER BY u.name""", (subj, today, cid))
    lock = fetchone("""SELECT * FROM attendance_locks
                       WHERE class_id=? AND subject=? AND date=?""", (cid, subj, today))
    return jsonify({"students": students, "locked": lock is not None}), 200

# ── CHECK LOCK STATUS ──────────────────────────────────────────────────────
@smart_bp.route("/lock-status", methods=["GET"])
@jwt_required()
def lock_status():
    cid  = request.args.get("class_id"); subj = request.args.get("subject","")
    today = request.args.get("date", str(date.today()))
    lock = fetchone("""SELECT * FROM attendance_locks
                       WHERE class_id=? AND subject=? AND date=?""", (cid, subj, today))
    audit = fetchall("""SELECT * FROM attendance_audit
                        WHERE class_id=? AND subject=? AND date=?
                        ORDER BY changed_at DESC""", (cid, subj, today))
    return jsonify({"locked": lock is not None, "lock": lock, "audit_trail": audit}), 200

# ── REGISTERED FACES count ─────────────────────────────────────────────────
@smart_bp.route("/face-status/<int:cid>", methods=["GET"])
@jwt_required()
def face_status(cid):
    total = fetchone("SELECT COUNT(*) as c FROM class_students WHERE class_id=?", (cid,))["c"]
    registered = fetchone("""SELECT COUNT(*) as c FROM class_students cs
                              JOIN users u ON u.roll_no=cs.student_roll
                              WHERE cs.class_id=? AND u.face_encoding!='' AND u.face_encoding IS NOT NULL""",
                           (cid,))["c"]
    students = fetchall("""SELECT u.roll_no, u.name,
                                  CASE WHEN u.face_encoding!='' AND u.face_encoding IS NOT NULL
                                       THEN 1 ELSE 0 END as has_face,
                                  u.photo_path
                           FROM class_students cs JOIN users u ON u.roll_no=cs.student_roll
                           WHERE cs.class_id=? ORDER BY u.name""", (cid,))
    return jsonify({"total": total, "registered": registered, "students": students,
                    "fr_available": FR_AVAILABLE}), 200