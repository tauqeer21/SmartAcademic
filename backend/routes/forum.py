import json
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from db_helpers import fetchall, fetchone, execute

forum_bp = Blueprint("forum", __name__)
def cu(): return json.loads(get_jwt_identity())

@forum_bp.route("/questions", methods=["POST"])
@jwt_required()
def post_q():
    u=cu(); d=request.get_json()
    cid=d.get("class_id"); title=d.get("title","").strip()
    if not cid or not title: return jsonify({"error":"class_id and title required"}),400
    qid=execute("INSERT INTO forum_questions (class_id,student_roll,subject,title,body) VALUES (?,?,?,?,?)",
                (cid,u["roll_no"],d.get("subject",""),title,d.get("body","")))

    # Auto-trigger AI answer in background thread — non-blocking
    import threading
    from flask import current_app
    app = current_app._get_current_object()
    body_text = d.get("body","")
    subj_text  = d.get("subject","")

    def _ai_answer_bg():
        with app.app_context():
            try:
                from ai_helper import ask_gemini, get_rich_context_for_class
                ctx = get_rich_context_for_class(cid, subj_text)
                ctx_part = ("Relevant course notes:\n" + ctx) if ctx else ""
                prompt = (
                    f"You are an expert academic AI assistant embedded in a college forum. "
                    f"Answer this student question clearly and educationally.\n\n"
                    f"Subject: {subj_text or 'General'}\n"
                    f"Question: {title}\n"
                    f"Details: {body_text or 'No additional details'}\n"
                    f"{ctx_part}\n\n"
                    f"Give a helpful, accurate answer in 150-250 words. "
                    f"If the question is unclear, state assumptions. "
                    f"End with 1 follow-up tip or resource if relevant."
                )
                ans = ask_gemini(prompt)
                execute("INSERT INTO forum_answers (question_id,roll_no,responder_name,role,answer) VALUES (?,?,?,?,?)",
                        (qid, "AI", "🤖 AI Assistant", "ai", ans))
                execute("UPDATE forum_questions SET is_ai_answered=1 WHERE id=?", (qid,))
            except Exception as e:
                pass  # Silent fail — student still gets their question posted

    threading.Thread(target=_ai_answer_bg, daemon=True).start()
    return jsonify({"id":qid,"message":"Posted","ai_answering":True}),201

@forum_bp.route("/questions/class/<int:cid>", methods=["GET"])
@jwt_required()
def get_qs(cid):
    subj=request.args.get("subject","")
    q="""SELECT fq.*,u.name AS student_name,
               (SELECT COUNT(*) FROM forum_answers fa WHERE fa.question_id=fq.id) AS answer_count
         FROM forum_questions fq LEFT JOIN users u ON u.roll_no=fq.student_roll
         WHERE fq.class_id=?"""
    p=[cid]
    if subj: q+=" AND fq.subject=?"; p.append(subj)
    q+=" ORDER BY fq.created_at DESC"
    return jsonify(fetchall(q,p)),200

@forum_bp.route("/questions/<int:qid>/answers", methods=["GET"])
@jwt_required()
def get_ans(qid):
    return jsonify(fetchall("SELECT * FROM forum_answers WHERE question_id=? ORDER BY created_at ASC",(qid,))),200

@forum_bp.route("/questions/<int:qid>/answer", methods=["POST"])
@jwt_required()
def post_ans(qid):
    u=cu(); ans=request.get_json().get("answer","").strip()
    if not ans: return jsonify({"error":"Answer required"}),400
    execute("INSERT INTO forum_answers (question_id,roll_no,responder_name,role,answer) VALUES (?,?,?,?,?)",
            (qid,u["roll_no"],u["name"],u["role"],ans))
    return jsonify({"message":"Posted"}),201

@forum_bp.route("/questions/<int:qid>/ai-answer", methods=["POST"])
@jwt_required()
def ai_ans(qid):
    q=fetchone("SELECT * FROM forum_questions WHERE id=?",(qid,))
    if not q: return jsonify({"error":"Not found"}),404
    from ai_helper import ask_gemini, get_rich_context_for_class
    ctx=get_rich_context_for_class(q["class_id"],q["subject"])
    ctx_part=("Relevant notes:\n"+ctx) if ctx else ""
    prompt=(f"You are an expert academic assistant. Answer this student question.\n"
            f'Question: "{q["title"]}"\nDetails: {q["body"] or ""}\nSubject: {q["subject"] or "General"}\n'
            f"{ctx_part}\nProvide a clear educational answer in 200-300 words.")
    try:
        ans=ask_gemini(prompt)
        execute("INSERT INTO forum_answers (question_id,roll_no,responder_name,role,answer) VALUES (?,?,?,?,?)",
                (qid,"AI","Gemini AI","ai",ans))
        execute("UPDATE forum_questions SET is_ai_answered=1 WHERE id=?",(qid,))
        return jsonify({"answer":ans}),200
    except Exception as e: return jsonify({"error":str(e)}),500

@forum_bp.route("/questions/<int:qid>", methods=["DELETE"])
@jwt_required()
def del_q(qid):
    u=cu()
    execute("DELETE FROM forum_questions WHERE id=? AND student_roll=?",(qid,u["roll_no"]))
    return jsonify({"message":"Deleted"}),200