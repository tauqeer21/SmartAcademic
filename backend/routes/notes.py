import json, os
from flask import Blueprint, request, jsonify, current_app, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from db_helpers import fetchall, fetchone, execute

notes_bp = Blueprint("notes", __name__)
def cu(): return json.loads(get_jwt_identity())
ALLOWED = {"pdf","docx","doc","pptx","txt","png","jpg","zip"}
def allowed(f): return "." in f and f.rsplit(".",1)[1].lower() in ALLOWED
CATS = ["General","PYQ","Books","Handout","Lab Manual"]

@notes_bp.route("/", methods=["POST"])
@jwt_required()
def upload():
    u=cu()
    if u["role"]!="teacher": return jsonify({"error":"Unauthorized"}),403
    cid=request.form.get("class_id"); subj=request.form.get("subject","").strip()
    title=request.form.get("title","").strip(); cat=request.form.get("category","General")
    if not all([cid,subj,title]): return jsonify({"error":"class_id, subject, title required"}),400
    if "file" not in request.files: return jsonify({"error":"File required"}),400
    f=request.files["file"]
    if not f or not f.filename or not allowed(f.filename): return jsonify({"error":"Invalid file"}),400
    fn=f.filename; fp=secure_filename(f"note_{cid}_{subj[:4]}_{fn}")
    f.save(os.path.join(current_app.config["UPLOAD_FOLDER"],fp))
    nid=execute("INSERT INTO notes (class_id,subject,teacher_id,title,category,file_path,file_name) VALUES (?,?,?,?,?,?,?)",
                (cid,subj,u["roll_no"],title,cat,fp,fn))
    return jsonify({"id":nid,"message":"Uploaded"}),201

@notes_bp.route("/class/<int:cid>", methods=["GET"])
@jwt_required()
def class_notes(cid):
    subj=request.args.get("subject",""); cat=request.args.get("category","")
    q="SELECT n.*,u.name AS teacher_name FROM notes n JOIN users u ON u.roll_no=n.teacher_id WHERE n.class_id=?"
    p=[cid]
    if subj: q+=" AND n.subject=?"; p.append(subj)
    if cat:  q+=" AND n.category=?"; p.append(cat)
    q+=" ORDER BY n.category, n.uploaded_at DESC"
    return jsonify(fetchall(q,p)),200

@notes_bp.route("/mine", methods=["GET"])
@jwt_required()
def my_notes():
    u=cu()
    if u["role"]!="student": return jsonify({"error":"Unauthorized"}),403
    subj=request.args.get("subject",""); cat=request.args.get("category","")
    q="""SELECT n.*,u.name AS teacher_name,c.name AS class_name
         FROM notes n
         JOIN class_students cs ON cs.class_id=n.class_id
         JOIN classes c ON c.id=n.class_id
         JOIN users u ON u.roll_no=n.teacher_id
         WHERE cs.student_roll=?"""
    p=[u["roll_no"]]
    if subj: q+=" AND n.subject=?"; p.append(subj)
    if cat:  q+=" AND n.category=?"; p.append(cat)
    q+=" ORDER BY n.category, n.uploaded_at DESC"
    return jsonify(fetchall(q,p)),200

@notes_bp.route("/download/<int:nid>", methods=["GET"])
@jwt_required()
def download(nid):
    n=fetchone("SELECT * FROM notes WHERE id=?",(nid,))
    if not n: return jsonify({"error":"Not found"}),404
    return send_from_directory(current_app.config["UPLOAD_FOLDER"],n["file_path"],
                               as_attachment=True,download_name=n["file_name"])

@notes_bp.route("/<int:nid>", methods=["DELETE"])
@jwt_required()
def delete(nid):
    u=cu()
    if u["role"]!="teacher": return jsonify({"error":"Unauthorized"}),403
    n=fetchone("SELECT * FROM notes WHERE id=? AND teacher_id=?",(nid,u["roll_no"]))
    if n and n["file_path"]:
        fp=os.path.join(current_app.config.get("UPLOAD_FOLDER","uploads"),n["file_path"])
        if os.path.exists(fp): os.remove(fp)
    execute("DELETE FROM notes WHERE id=? AND teacher_id=?",(nid,u["roll_no"]))
    return jsonify({"message":"Deleted"}),200
