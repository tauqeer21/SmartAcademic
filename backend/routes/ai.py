import json
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ai_helper import ask_gemini, get_rich_context_for_class
from db_helpers import fetchall, fetchone, execute

ai_bp = Blueprint("ai", __name__)
def cu(): return json.loads(get_jwt_identity())

def ctx_block(ctx, label="Uploaded notes/books content"):
    return (label + ":\n" + ctx) if ctx else ""

@ai_bp.route("/chat", methods=["POST"])
@jwt_required()
def chat():
    u=cu(); d=request.get_json()
    q=d.get("question","").strip(); cid=d.get("class_id"); subj=d.get("subject","")
    if not q: return jsonify({"error":"question required"}),400
    ctx=get_rich_context_for_class(cid,subj) if cid else ""
    name=u["name"]; subj_label=subj or "All subjects"; ctx_part=ctx_block(ctx)

    # Build personalized student data block
    student_data_block = ""
    if u["role"] == "student":
        from db_helpers import fetchall
        roll = u["roll_no"]
        att = fetchall("""SELECT subject,
                                 ROUND(SUM(CASE WHEN status='Present' THEN 1 ELSE 0 END)*100.0/COUNT(*),1) AS pct
                          FROM attendance WHERE student_roll=? GROUP BY subject""", (roll,))
        marks = fetchall("""SELECT subject, exam_type,
                                   ROUND(marks_obtained*100.0/NULLIF(marks_total,0),1) AS pct
                            FROM marks WHERE student_roll=? ORDER BY subject, exam_type""", (roll,))
        exams = fetchall("""SELECT ed.subject, ed.exam_type, ed.exam_date,
                                   CAST(julianday(ed.exam_date)-julianday('now') AS INTEGER) AS days_left
                            FROM exam_dates ed
                            JOIN class_students cs ON cs.class_id=ed.class_id
                            WHERE cs.student_roll=? AND ed.exam_date>=date('now')
                            ORDER BY ed.exam_date LIMIT 5""", (roll,))
        pending = fetchall("""SELECT a.subject, a.title, a.deadline
                              FROM assignments a
                              WHERE a.class_id IN (SELECT class_id FROM class_students WHERE student_roll=?)
                              AND a.id NOT IN (SELECT assignment_id FROM submissions WHERE student_roll=?)
                              AND a.deadline>=date('now')
                              ORDER BY a.deadline LIMIT 5""", (roll, roll))

        lines = [f"STUDENT DATA for {name} ({roll}):"]
        if att:
            lines.append("Attendance: " + ", ".join(f"{a['subject']} {a['pct']}%" for a in att))
        if marks:
            lines.append("Marks: " + ", ".join(f"{m['subject']} {m['exam_type']} {m['pct']}%" for m in marks))
        if exams:
            lines.append("Upcoming Exams: " + ", ".join(f"{e['subject']} {e['exam_type']} in {e['days_left']}d" for e in exams))
        if pending:
            lines.append("Pending Assignments: " + ", ".join(f"{p['subject']} - {p['title']} (due {p['deadline']})" for p in pending))
        student_data_block = "\n".join(lines)

    prompt=(
        f"You are a personalized academic AI assistant for a college student. "
        f"Use the student's actual data below to give specific, helpful advice.\n\n"
        f"{student_data_block}\n\n"
        f"Subject context: {subj_label}\n"
        f"{ctx_part}\n"
        f'Question: "{q}"\n\n'
        f"Give a direct, specific answer using the student's actual data when relevant. "
        f"If they ask about attendance or marks, refer to their actual numbers. Max 350 words."
    )
    try: return jsonify({"answer":ask_gemini(prompt)}),200
    except Exception as e: return jsonify({"error":str(e)}),500

@ai_bp.route("/explain-assignment", methods=["POST"])
@jwt_required()
def explain():
    u=cu(); d=request.get_json(); aid=d.get("assignment_id")
    a=fetchone("SELECT * FROM assignments WHERE id=?",(aid,))
    if not a: return jsonify({"error":"Not found"}),404
    ctx=get_rich_context_for_class(a["class_id"],a["subject"])
    ctx_part=ctx_block(ctx,"Relevant course material")
    title=a['title']; subject=a['subject']; desc=a.get('description') or 'No description'
    prompt=(
        f"Explain this college assignment to a student in simple, clear terms:\n"
        f"Title: {title}\nSubject: {subject}\nDescription: {desc}\n{ctx_part}\n"
        f"Provide: 1) What it's asking, 2) Key concepts needed, "
        f"3) Step-by-step approach, 4) What high marks look like, 5) Common mistakes to avoid."
    )
    try: return jsonify({"explanation":ask_gemini(prompt)}),200
    except Exception as e: return jsonify({"error":str(e)}),500

@ai_bp.route("/generate-paper", methods=["POST"])
@jwt_required()
def gen_paper():
    u = cu()
    if u["role"] != "teacher": return jsonify({"error": "Unauthorized"}), 403
    d    = request.get_json()
    cid  = d.get("class_id"); subj = d.get("subject","").strip()
    if not subj: return jsonify({"error": "subject required"}), 400

    # Teacher-provided metadata
    college    = d.get("college",    "University Institute of Engineering")
    branch     = d.get("branch",     "B.Tech (CSE)")
    semester   = d.get("semester",   "4th Semester")
    exam_type  = d.get("exam_type",  "First Mid-Semester Examination")
    subj_code  = d.get("subj_code",  "")
    duration   = d.get("duration",   "1:30 Hrs")
    total      = int(d.get("total_marks", 24))
    difficulty = d.get("difficulty", "Medium")
    topic      = d.get("topic",      "")

    ctx = get_rich_context_for_class(cid, subj) if cid else ""
    ctx_part = (f"Course notes/textbook content to base questions on:\n{ctx}\n\n") if ctx else ""
    topic_hint = f"Focus especially on: {topic}\n" if topic else ""

    # Determine section breakdown based on total marks
    if total <= 24:
        sec_a = {"q":4,"m":2,"total":8,"attempt":"all"}
        sec_b = {"q":3,"m":4,"total":8,"attempt":"any 2"}
        sec_c = {"q":2,"m":8,"total":8,"attempt":"any 1"}
    elif total <= 30:
        sec_a = {"q":5,"m":2,"total":10,"attempt":"all"}
        sec_b = {"q":3,"m":5,"total":15,"attempt":"any 3"}
        sec_c = {"q":2,"m":5,"total":5,"attempt":"any 1"}
    else:  # 50/80 marks
        sec_a = {"q":8,"m":2,"total":16,"attempt":"all"}
        sec_b = {"q":5,"m":5,"total":25,"attempt":"any 5"}
        sec_c = {"q":3,"m":10,"total":30,"attempt":"any 3"}

    prompt = f"""You are a university professor generating an official examination paper.
Generate questions for subject: {subj}
{ctx_part}{topic_hint}Difficulty: {difficulty}

Generate EXACTLY this JSON structure (no other text, just valid JSON):
{{
  "course_outcomes": [
    {{"co": "CO1", "description": "..."}},
    {{"co": "CO2", "description": "..."}},
    {{"co": "CO3", "description": "..."}},
    {{"co": "CO4", "description": "..."}},
    {{"co": "CO5", "description": "..."}}
  ],
  "section_a": [
    {{"sno": 1, "question": "...", "marks": "2", "co": "CO1", "bloom": "L1"}},
    {{"sno": 2, "question": "...", "marks": "(1+1=2)", "co": "CO2", "bloom": "L2"}},
    {{"sno": 3, "question": "...", "marks": "2", "co": "CO1", "bloom": "L1"}},
    {{"sno": 4, "question": "...", "marks": "(1+1=2)", "co": "CO3", "bloom": "L2"}}
  ],
  "section_b": [
    {{"sno": 5, "question": "...", "marks": "{sec_b['m']}", "co": "CO2", "bloom": "L3"}},
    {{"sno": 6, "question": "...", "marks": "{sec_b['m']}", "co": "CO1", "bloom": "L3"}},
    {{"sno": 7, "question": "...", "marks": "{sec_b['m']}", "co": "CO1", "bloom": "L4"}}
  ],
  "section_c": [
    {{"sno": 8, "question": "...", "marks": "(4+4=8)", "co": "CO3", "bloom": "L4"}},
    {{"sno": 9, "question": "...", "marks": "8", "co": "CO2", "bloom": "L5"}}
  ]
}}

Rules:
- Questions must be specific and academic, NOT generic. Use exact subject terminology.
- Section A: short definition/comparison questions (2 marks each, {sec_a['q']} questions)
- Section B: applied/analytical questions ({sec_b['m']} marks each, {sec_b['q']} questions, attempt {sec_b['attempt']})
- Section C: long descriptive/design questions ({sec_c['m']} marks each, {sec_c['q']} questions, attempt {sec_c['attempt']})
- CO must be CO1-CO5, Bloom must be L1-L6
- For multi-part questions use format like "(2+2=4)" in marks field
- Course outcomes must be specific to {subj}
- Return ONLY valid JSON, no markdown, no explanation"""

    try:
        import json as _json, re as _re
        raw = ask_gemini(prompt)
        # Extract JSON from response
        match = _re.search(r'\{{.*\}}', raw, _re.DOTALL)
        if not match:
            raise ValueError("No JSON found in response")
        data = _json.loads(match.group())

        # Now generate the PDF
        from flask import make_response
        import io
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.units import mm
        from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
                                         TableStyle, HRFlowable)
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY

        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=A4,
                                topMargin=10*mm, bottomMargin=12*mm,
                                leftMargin=15*mm, rightMargin=15*mm)

        styles = getSampleStyleSheet()
        W      = 180*mm  # usable width

        # ── Styles ──
        def sty(name, **kw):
            base = kw.pop("parent", styles["Normal"])
            return ParagraphStyle(name, parent=base, **kw)

        center  = sty("C",   alignment=TA_CENTER, fontSize=9,  leading=13)
        bold_c  = sty("BC",  alignment=TA_CENTER, fontSize=10, leading=14, fontName="Helvetica-Bold")
        bold_c2 = sty("BC2", alignment=TA_CENTER, fontSize=9,  leading=13, fontName="Helvetica-Bold")
        bold_l  = sty("BL",  alignment=TA_LEFT,   fontSize=9,  leading=13, fontName="Helvetica-Bold")
        bold_r  = sty("BR",  alignment=TA_RIGHT,  fontSize=9,  leading=13, fontName="Helvetica-Bold")
        small   = sty("S",   alignment=TA_LEFT,   fontSize=8.5,leading=13)
        small_c = sty("SC",  alignment=TA_CENTER, fontSize=8.5,leading=13)
        inst    = sty("INS", alignment=TA_LEFT,   fontSize=8.5,leading=14)
        sec_hdr = sty("SH",  alignment=TA_CENTER, fontSize=9,  leading=13, fontName="Helvetica-Bold")

        BK = colors.black
        GRAY = colors.HexColor("#c8c8c8")

        def grid(data, col_w, header_row=True):
            cmds = [
                ("GRID",         (0,0),(-1,-1), 0.5, BK),
                ("VALIGN",       (0,0),(-1,-1), "MIDDLE"),
                ("TOPPADDING",   (0,0),(-1,-1), 4),
                ("BOTTOMPADDING",(0,0),(-1,-1), 4),
                ("LEFTPADDING",  (0,0),(-1,-1), 5),
                ("RIGHTPADDING", (0,0),(-1,-1), 5),
            ]
            if header_row:
                cmds += [
                    ("BACKGROUND",(0,0),(-1,0), GRAY),
                    ("FONTNAME",  (0,0),(-1,0), "Helvetica-Bold"),
                ]
            t = Table(data, colWidths=col_w)
            t.setStyle(TableStyle(cmds))
            return t

        total_q = len(data.get("section_a",[])) + len(data.get("section_b",[])) + len(data.get("section_c",[]))
        story = []

        # ── TOP ROW: Roll No boxes + Date boxes ──
        def box_row(label, n):
            cells = [Paragraph(f"<b>{label}</b>", sty("RL", fontSize=8, fontName="Helvetica-Bold"))]
            cells += [Paragraph("", center) for _ in range(n)]
            widths = [20*mm] + [8*mm]*n
            t = Table([cells], colWidths=widths)
            t.setStyle(TableStyle([
                ("BOX",          (0,0),(0,0),  0,   colors.white),
                ("GRID",         (1,0),(-1,0), 0.7, BK),
                ("TOPPADDING",   (0,0),(-1,0), 5),
                ("BOTTOMPADDING",(0,0),(-1,0), 5),
                ("FONTSIZE",     (0,0),(-1,0), 8),
            ]))
            return t

        top_row = Table([[box_row("Roll\nNo.", 8), box_row("Date", 8)]],
                         colWidths=[W/2, W/2])
        top_row.setStyle(TableStyle([("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0)]))
        story.append(top_row)

        # Total Questions / Total Pages row
        tq_row = Table([[
            Paragraph(f"Total No. of Questions: {total_q}", sty("TQ", fontSize=8)),
            Paragraph("Total No. of Pages: 1", sty("TP", fontSize=8, alignment=TA_RIGHT))
        ]], colWidths=[W/2, W/2])
        tq_row.setStyle(TableStyle([("TOPPADDING",(0,0),(-1,-1),2),("BOTTOMPADDING",(0,0),(-1,-1),4)]))
        story.append(tq_row)
        story.append(HRFlowable(width="100%", thickness=0.8, color=BK, spaceAfter=3))

        # ── COLLEGE HEADER (centered) ──
        story.append(Paragraph(f"<b>{college.upper()}</b>", bold_c))
        story.append(Paragraph(f"<b>{branch} ({semester})</b>", bold_c2))
        story.append(Paragraph(exam_type, center))
        story.append(Paragraph(f"Subject: {subj}", center))
        if subj_code:
            story.append(Paragraph(f"Subject Code: {subj_code}", center))

        # Time left, Max Marks right
        story.append(Spacer(1, 2))
        tm = Table([[Paragraph(f"Time: {duration}", bold_l),
                     Paragraph(f"Max. Marks: {total}", bold_r)]],
                   colWidths=[W/2, W/2])
        tm.setStyle(TableStyle([("TOPPADDING",(0,0),(-1,-1),4),("BOTTOMPADDING",(0,0),(-1,-1),2)]))
        story.append(tm)
        story.append(HRFlowable(width="100%", thickness=0.8, color=BK, spaceAfter=4))

        # ── INSTRUCTIONS ──
        story.append(Paragraph("<b>INSTRUCTIONS TO CANDIDATES:</b>", inst))
        story.append(Paragraph(
            f"1. Section-A is compulsory consisting of {sec_a['q']} questions carrying {sec_a['m']} marks each.", inst))
        story.append(Paragraph(
            f"2. Section-B contains {sec_b['q']} questions carrying {sec_b['m']} marks each "
            f"and students have to attempt any {sec_b['attempt'].replace('any ','')} questions.", inst))
        story.append(Paragraph(
            f"3. Section-C contains {sec_c['q']} questions carrying {sec_c['m']} marks each "
            f"and students have to attempt any {sec_c['attempt'].replace('any ','')} question.", inst))
        story.append(Spacer(1, 5))

        # ── COURSE OUTCOMES ──
        story.append(Paragraph("<b>Course Outcomes</b>", sec_hdr))
        story.append(Paragraph("<b>The students will be able to:</b>", inst))
        co_descs = [co["description"] for co in data.get("course_outcomes", [])]
        while len(co_descs) < 5: co_descs.append("")
        co_rows = []
        for co, desc in zip(["CO1","CO2","CO3","CO4","CO5"], co_descs):
            co_rows.append([Paragraph(f"<b>{co}</b>", small_c), Paragraph(desc, small)])
        story.append(grid(co_rows, [14*mm, W-14*mm], header_row=False))
        story.append(Spacer(1, 4))

        # ── BLOOM'S ──
        blooms_box = Table([[
            Paragraph("<b>Bloom's Taxonomy Levels</b>", sec_hdr)
        ]], colWidths=[W])
        blooms_box.setStyle(TableStyle([
            ("BOX",(0,0),(-1,-1),0.5,BK),
            ("TOPPADDING",(0,0),(-1,-1),3),("BOTTOMPADDING",(0,0),(-1,-1),3)
        ]))
        story.append(blooms_box)
        story.append(Paragraph(
            "L1- Remembering, L2- Understanding, L3- Applying, L4-Analyzing, L5- Evaluating, L6- Creating",
            center))
        story.append(Spacer(1, 5))

        # ── Q TABLE HELPER ──
        q_header = [
            Paragraph("<b>S. No.</b>", sec_hdr),
            Paragraph("<b>Questions</b>", sec_hdr),
            Paragraph("<b>Marks Distribution</b>", sec_hdr),
            Paragraph("<b>Relevance to CO</b>", sec_hdr),
            Paragraph("<b>Bloom's Level</b>", sec_hdr),
        ]
        COL_W = [11*mm, 103*mm, 22*mm, 22*mm, 22*mm]

        def q_table(qs):
            rows = [q_header]
            for q in qs:
                rows.append([
                    Paragraph(str(q["sno"]), small_c),
                    Paragraph(q["question"], small),
                    Paragraph(str(q["marks"]), small_c),
                    Paragraph(q["co"], small_c),
                    Paragraph(q["bloom"], small_c),
                ])
            return grid(rows, COL_W, header_row=True)

        # ── SECTION A ──
        story.append(Paragraph(
            f"Section – A ({sec_a['q']} Questions ×{sec_a['m']} marks = {sec_a['total']} marks)",
            sec_hdr))
        story.append(q_table(data.get("section_a", [])))
        story.append(Spacer(1, 6))

        # ── SECTION B ──
        story.append(Paragraph(
            f"Section – B ({sec_b['q']} Questions × {sec_b['m']} marks = {sec_b['total']} marks)",
            sec_hdr))
        story.append(q_table(data.get("section_b", [])))
        story.append(Spacer(1, 6))

        # ── SECTION C ──
        story.append(Paragraph(
            f"Section – C ({sec_c['q']} Questions × {sec_c['m']} marks = {sec_c['total']} marks)",
            sec_hdr))
        story.append(q_table(data.get("section_c", [])))

        doc.build(story)
        buf.seek(0)

        # Save content text for DB storage
        content_text = _json.dumps(data)
        pid = execute("INSERT INTO question_papers (teacher_id,class_id,subject,content) VALUES (?,?,?,?)",
                      (u["roll_no"], cid or 0, subj, content_text))

        # Return PDF directly
        from flask import make_response
        response = make_response(buf.read())
        response.headers["Content-Type"]        = "application/pdf"
        response.headers["Content-Disposition"] = f'attachment; filename="QP_{subj}_{exam_type}.pdf"'
        response.headers["X-Paper-Id"]          = str(pid)
        return response

    except Exception as e:
        return jsonify({"error": str(e)}), 500



@ai_bp.route("/generate-paper-data", methods=["POST"])
@jwt_required()
def gen_paper_data():
    """Generate paper as JSON for interactive editor"""
    u = cu()
    if u["role"] != "teacher": return jsonify({"error":"Unauthorized"}), 403
    d   = request.get_json()
    cid = d.get("class_id"); subj = d.get("subject","").strip()
    if not subj: return jsonify({"error":"subject required"}), 400
    total      = int(d.get("total_marks", 24))
    difficulty = d.get("difficulty","Medium")
    topic      = d.get("topic","")
    ctx        = get_rich_context_for_class(cid, subj) if cid else ""
    ctx_part   = (f"Course notes:\n{ctx}\n\n") if ctx else ""
    topic_hint = f"Focus especially on: {topic}\n" if topic else ""
    if total <= 24:
        sa={"q":4,"m":2,"total":8,"attempt":"all"}; sb={"q":3,"m":4,"total":8,"attempt":"any 2"}; sc={"q":2,"m":8,"total":8,"attempt":"any 1"}
    elif total <= 30:
        sa={"q":5,"m":2,"total":10,"attempt":"all"}; sb={"q":3,"m":5,"total":15,"attempt":"any 3"}; sc={"q":2,"m":5,"total":5,"attempt":"any 1"}
    else:
        sa={"q":8,"m":2,"total":16,"attempt":"all"}; sb={"q":5,"m":5,"total":25,"attempt":"any 5"}; sc={"q":3,"m":10,"total":30,"attempt":"any 3"}

    prompt = (
        f"You are a university professor for subject: {subj}\n"
        f"{ctx_part}{topic_hint}Difficulty: {difficulty}\n\n"
        f"Return ONLY valid JSON (no markdown):\n"
        f'{{"course_outcomes":[{{"co":"CO1","description":"..."}},{{"co":"CO2","description":"..."}},{{"co":"CO3","description":"..."}},{{"co":"CO4","description":"..."}},{{"co":"CO5","description":"..."}}],'
        f'"section_a":[{{"sno":1,"question":"...","marks":"2","co":"CO1","bloom":"L1"}},{{"sno":2,"question":"...","marks":"(1+1=2)","co":"CO2","bloom":"L2"}},{{"sno":3,"question":"...","marks":"2","co":"CO1","bloom":"L1"}},{{"sno":4,"question":"...","marks":"(1+1=2)","co":"CO3","bloom":"L2"}}],'
        f'"section_b":[{{"sno":5,"question":"...","marks":"{sb["m"]}","co":"CO2","bloom":"L3"}},{{"sno":6,"question":"...","marks":"{sb["m"]}","co":"CO1","bloom":"L3"}},{{"sno":7,"question":"...","marks":"{sb["m"]}","co":"CO1","bloom":"L4"}}],'
        f'"section_c":[{{"sno":8,"question":"...","marks":"(4+4=8)","co":"CO3","bloom":"L4"}},{{"sno":9,"question":"...","marks":"{sc["m"]}","co":"CO2","bloom":"L5"}}],'
        f'"question_bank":['
        f'{{"question":"...","section":"A","marks":"2","co":"CO1","bloom":"L1"}},'
        f'{{"question":"...","section":"A","marks":"2","co":"CO2","bloom":"L2"}},'
        f'{{"question":"...","section":"A","marks":"(1+1=2)","co":"CO3","bloom":"L2"}},'
        f'{{"question":"...","section":"A","marks":"2","co":"CO4","bloom":"L1"}},'
        f'{{"question":"...","section":"B","marks":"{sb["m"]}","co":"CO2","bloom":"L3"}},'
        f'{{"question":"...","section":"B","marks":"{sb["m"]}","co":"CO3","bloom":"L4"}},'
        f'{{"question":"...","section":"B","marks":"{sb["m"]}","co":"CO1","bloom":"L3"}},'
        f'{{"question":"...","section":"C","marks":"{sc["m"]}","co":"CO2","bloom":"L5"}},'
        f'{{"question":"...","section":"C","marks":"(4+4={sc["m"]})","co":"CO4","bloom":"L4"}},'
        f'{{"question":"...","section":"C","marks":"{sc["m"]}","co":"CO3","bloom":"L5"}}]}}\n\n'
        f"Rules: questions specific to {subj}, CO=CO1-CO5, Bloom=L1-L6, return ONLY JSON"
    )
    try:
        import json as _j, re as _re
        raw = ask_gemini(prompt)
        m   = _re.search(r"\{.*\}", raw, _re.DOTALL)
        if not m: raise ValueError("No JSON")
        data = _j.loads(m.group())
        data["sec_config"] = {"sec_a":sa,"sec_b":sb,"sec_c":sc}
        return jsonify(data), 200
    except Exception as e:
        return jsonify({"error":str(e)}), 500


@ai_bp.route("/more-questions", methods=["POST"])
@jwt_required()
def more_questions():
    """Ask AI for more questions"""
    u = cu()
    if u["role"] != "teacher": return jsonify({"error":"Unauthorized"}), 403
    d    = request.get_json()
    subj = d.get("subject",""); req  = d.get("request",""); cid = d.get("class_id")
    ctx  = get_rich_context_for_class(cid, subj) if cid else ""
    ctx_part = (f"Course notes:\n{ctx}\n\n") if ctx else ""
    prompt = (
        f"University professor for subject: {subj}\n{ctx_part}"
        f'Teacher request: "{req}"\n\n'
        f"Generate 6 questions. Return ONLY valid JSON array:\n"
        f'[{{"question":"...","section":"A","marks":"2","co":"CO1","bloom":"L1"}}]\n'
        f"Section A=2marks, B=4-5marks, C=8marks. Specific to {subj}."
    )
    try:
        import json as _j, re as _re
        raw = ask_gemini(prompt)
        m   = _re.search(r"\[.*\]", raw, _re.DOTALL)
        if not m: raise ValueError("No JSON array")
        return jsonify({"questions": _j.loads(m.group())}), 200
    except Exception as e:
        return jsonify({"error":str(e)}), 500


@ai_bp.route("/build-paper-pdf", methods=["POST"])
@jwt_required()
def build_paper_pdf():
    """Build PDF from editor state"""
    u = cu()
    if u["role"] != "teacher": return jsonify({"error":"Unauthorized"}), 403
    from flask import make_response
    import io, json as _j
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

    d     = request.get_json()
    paper = d.get("paper_data", {})
    meta  = d.get("meta", {})
    college   = meta.get("college","University Institute of Engineering")
    branch    = meta.get("branch","B.Tech (CSE)")
    semester  = meta.get("semester","4th Semester")
    exam_type = meta.get("exam_type","First Mid-Semester Examination")
    subj      = meta.get("subject","Subject")
    subj_code = meta.get("subj_code","")
    duration  = meta.get("duration","1:30 Hrs")
    total     = int(meta.get("total_marks",24))
    cfg       = paper.get("sec_config",{})
    sa = cfg.get("sec_a",{"q":4,"m":2,"total":8,"attempt":"all"})
    sb = cfg.get("sec_b",{"q":3,"m":4,"total":8,"attempt":"any 2"})
    sc = cfg.get("sec_c",{"q":2,"m":8,"total":8,"attempt":"any 1"})

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf,pagesize=A4,topMargin=10*mm,bottomMargin=12*mm,leftMargin=15*mm,rightMargin=15*mm)
    ss  = getSampleStyleSheet(); W = 180*mm
    def sty(n,**kw):
        b=kw.pop("parent",ss["Normal"]); return ParagraphStyle(n,parent=b,**kw)
    C   = sty("C",  alignment=TA_CENTER,fontSize=9, leading=13)
    BC  = sty("BC", alignment=TA_CENTER,fontSize=10,leading=14,fontName="Helvetica-Bold")
    BC2 = sty("BC2",alignment=TA_CENTER,fontSize=9, leading=13,fontName="Helvetica-Bold")
    BL  = sty("BL", alignment=TA_LEFT,  fontSize=9, leading=13,fontName="Helvetica-Bold")
    BR  = sty("BR", alignment=TA_RIGHT, fontSize=9, leading=13,fontName="Helvetica-Bold")
    SM  = sty("SM", alignment=TA_LEFT,  fontSize=8.5,leading=13)
    SC  = sty("SC", alignment=TA_CENTER,fontSize=8.5,leading=13)
    IN  = sty("IN", alignment=TA_LEFT,  fontSize=8.5,leading=14)
    SH  = sty("SH", alignment=TA_CENTER,fontSize=9, leading=13,fontName="Helvetica-Bold")
    BK  = colors.black; GR = colors.HexColor("#c8c8c8")

    def tbl(rows,cw,hdr=True):
        t=Table(rows,colWidths=cw)
        cmds=[("GRID",(0,0),(-1,-1),0.5,BK),("VALIGN",(0,0),(-1,-1),"MIDDLE"),
              ("TOPPADDING",(0,0),(-1,-1),4),("BOTTOMPADDING",(0,0),(-1,-1),4),
              ("LEFTPADDING",(0,0),(-1,-1),5),("RIGHTPADDING",(0,0),(-1,-1),5)]
        if hdr: cmds+=[("BACKGROUND",(0,0),(-1,0),GR),("FONTNAME",(0,0),(-1,0),"Helvetica-Bold")]
        t.setStyle(TableStyle(cmds)); return t

    tq = len(paper.get("section_a",[]))+len(paper.get("section_b",[]))+len(paper.get("section_c",[]))
    st = []

    def box_row(label,n):
        cells=[Paragraph(f"<b>{label}</b>",sty("RL",fontSize=8,fontName="Helvetica-Bold"))]+[Paragraph("",C) for _ in range(n)]
        t=Table([cells],colWidths=[20*mm]+[8*mm]*n)
        t.setStyle(TableStyle([("GRID",(1,0),(-1,0),0.7,BK),("BOX",(0,0),(0,0),0,colors.white),
                               ("TOPPADDING",(0,0),(-1,0),5),("BOTTOMPADDING",(0,0),(-1,0),5)])); return t

    top=Table([[box_row("Roll No.",8),box_row("Date",8)]],colWidths=[W/2,W/2])
    top.setStyle(TableStyle([("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0)]))
    st.append(top)
    tqr=Table([[Paragraph(f"Total No. of Questions: {tq}",sty("TQ",fontSize=8)),
                Paragraph("Total No. of Pages: 1",sty("TP",fontSize=8,alignment=TA_RIGHT))]],colWidths=[W/2,W/2])
    tqr.setStyle(TableStyle([("TOPPADDING",(0,0),(-1,-1),2),("BOTTOMPADDING",(0,0),(-1,-1),4)]))
    st.append(tqr)
    st.append(HRFlowable(width="100%",thickness=0.8,color=BK,spaceAfter=3))
    st.append(Paragraph(f"<b>{college.upper()}</b>",BC))
    st.append(Paragraph(f"<b>{branch} ({semester})</b>",BC2))
    st.append(Paragraph(exam_type,C))
    st.append(Paragraph(f"Subject: {subj}"+(f"  |  Subject Code: {subj_code}" if subj_code else ""),C))
    st.append(Spacer(1,2))
    tm=Table([[Paragraph(f"Time: {duration}",BL),Paragraph(f"Max. Marks: {total}",BR)]],colWidths=[W/2,W/2])
    tm.setStyle(TableStyle([("TOPPADDING",(0,0),(-1,-1),4),("BOTTOMPADDING",(0,0),(-1,-1),2)]))
    st.append(tm)
    st.append(HRFlowable(width="100%",thickness=0.8,color=BK,spaceAfter=4))
    st.append(Paragraph("<b>INSTRUCTIONS TO CANDIDATES:</b>",IN))
    st.append(Paragraph(f"1. Section-A is compulsory consisting of {sa['q']} questions carrying {sa['m']} marks each.",IN))
    st.append(Paragraph(f"2. Section-B contains {sb['q']} questions carrying {sb['m']} marks each and students have to attempt any {str(sb['attempt']).replace('any ','')} questions.",IN))
    st.append(Paragraph(f"3. Section-C contains {sc['q']} questions carrying {sc['m']} marks each and students have to attempt any {str(sc['attempt']).replace('any ','')} question.",IN))
    st.append(Spacer(1,5))
    st.append(Paragraph("<b>Course Outcomes</b>",SH))
    st.append(Paragraph("<b>The students will be able to:</b>",IN))
    cos=paper.get("course_outcomes",[])
    if cos:
        st.append(tbl([[Paragraph(f"<b>{c['co']}</b>",SC),Paragraph(c['description'],SM)] for c in cos],[14*mm,W-14*mm],hdr=False))
    st.append(Spacer(1,4))
    bl=Table([[Paragraph("<b>Bloom's Taxonomy Levels</b>",SH)]],colWidths=[W])
    bl.setStyle(TableStyle([("BOX",(0,0),(-1,-1),0.5,BK),("TOPPADDING",(0,0),(-1,-1),3),("BOTTOMPADDING",(0,0),(-1,-1),3)]))
    st.append(bl)
    st.append(Paragraph("L1- Remembering, L2- Understanding, L3- Applying, L4-Analyzing, L5- Evaluating, L6- Creating",C))
    st.append(Spacer(1,5))

    QH=[Paragraph(f"<b>{h}</b>",SH) for h in ["S. No.","Questions","Marks Distribution","Relevance to CO","Bloom's Level"]]
    CW=[11*mm,103*mm,22*mm,22*mm,22*mm]

    def q_sec(label,qs):
        rows=[QH[:]]+[[Paragraph(str(q.get("sno",i+1)),SC),Paragraph(str(q.get("question","")),SM),
                       Paragraph(str(q.get("marks","")),SC),Paragraph(str(q.get("co","")),SC),
                       Paragraph(str(q.get("bloom","")),SC)] for i,q in enumerate(qs)]
        st.append(Paragraph(label,SH)); st.append(tbl(rows,CW)); st.append(Spacer(1,6))

    q_sec(f"Section – A ({sa['q']} Questions ×{sa['m']} marks = {sa['total']} marks)",paper.get("section_a",[]))
    q_sec(f"Section – B ({sb['q']} Questions × {sb['m']} marks = {sb['total']} marks)",paper.get("section_b",[]))
    q_sec(f"Section – C ({sc['q']} Questions × {sc['m']} marks = {sc['total']} marks)",paper.get("section_c",[]))

    doc.build(st); buf.seek(0)
    pid=execute("INSERT INTO question_papers (teacher_id,class_id,subject,content) VALUES (?,?,?,?)",
                (u["roll_no"],d.get("class_id") or 0,subj,_j.dumps(paper)))
    resp=make_response(buf.read())
    resp.headers["Content-Type"]="application/pdf"
    resp.headers["Content-Disposition"]=f'attachment; filename="QP_{subj}.pdf"'
    resp.headers["X-Paper-Id"]=str(pid)
    return resp

@ai_bp.route("/lesson-plan", methods=["POST"])
@jwt_required()
def lesson_plan():
    u=cu()
    if u["role"]!="teacher": return jsonify({"error":"Unauthorized"}),403
    d=request.get_json(); subj=d.get("subject",""); topic=d.get("topic","")
    if not subj or not topic: return jsonify({"error":"subject and topic required"}),400
    ctx=get_rich_context_for_class(d.get("class_id",0),subj) if d.get("class_id") else ""
    ctx_part=ctx_block(ctx,"Available course material"); duration=d.get('duration',60)
    prompt=(
        f"Create a detailed lesson plan for a college teacher.\n"
        f"Subject: {subj} | Topic: {topic} | Duration: {duration} minutes\n"
        f"{ctx_part}\n"
        f"Include: 1) Learning Objectives, 2) Introduction/Hook, "
        f"3) Content breakdown with timing, 4) Activities & Examples, "
        f"5) Assessment questions, 6) Summary & Homework."
    )
    try: return jsonify({"plan":ask_gemini(prompt)}),200
    except Exception as e: return jsonify({"error":str(e)}),500

@ai_bp.route("/rubric", methods=["POST"])
@jwt_required()
def rubric():
    u=cu()
    if u["role"]!="teacher": return jsonify({"error":"Unauthorized"}),403
    d=request.get_json()
    asgn_title=d.get('assignment_title',''); subject=d.get('subject',''); total=d.get('total_marks',100)
    prompt=(
        f"Create a detailed grading rubric for this college assignment:\n"
        f"Assignment: {asgn_title} | Subject: {subject} | Total Marks: {total}\n"
        f"Include 4-5 criteria with Excellent/Good/Average/Poor descriptors and mark ranges. "
        f"Format as a table."
    )
    try: return jsonify({"rubric":ask_gemini(prompt)}),200
    except Exception as e: return jsonify({"error":str(e)}),500

@ai_bp.route("/generate-mcq", methods=["POST"])
@jwt_required()
def gen_mcq():
    u=cu()
    if u["role"]!="teacher": return jsonify({"error":"Unauthorized"}),403
    d=request.get_json(); subj=d.get("subject","")
    ctx=get_rich_context_for_class(d.get("class_id",0),subj) if d.get("class_id") else ""
    ctx_part=ctx_block(ctx,"Based on"); num_q=d.get('num_questions',10)
    topic_part=(" on: "+d['topic']) if d.get('topic') else ''
    prompt=(
        f'Generate {num_q} MCQ questions for "{subj}"{topic_part}.\n'
        f"{ctx_part}\n"
        f"Format each as:\nQ1. [Question]\na) A  b) B  c) C  d) D\n"
        f"Answer: [letter]) [brief explanation]"
    )
    try: return jsonify({"mcqs":ask_gemini(prompt)}),200
    except Exception as e: return jsonify({"error":str(e)}),500

@ai_bp.route("/summarize", methods=["POST"])
@jwt_required()
def summarize():
    text=request.get_json().get("text","")
    if len(text)<30: return jsonify({"error":"Text too short"}),400
    prompt="Summarize this academic text into clear bullet points (max 200 words):\n"+text
    try: return jsonify({"summary":ask_gemini(prompt)}),200
    except Exception as e: return jsonify({"error":str(e)}),500

@ai_bp.route("/progress-report", methods=["POST"])
@jwt_required()
def progress_report():
    """Generate AI progress reports for all students in a class"""
    u = cu()
    if u["role"] != "teacher": return jsonify({"error": "Unauthorized"}), 403
    d = request.get_json()
    cid = d.get("class_id"); exam_type = d.get("exam_type", "MST1")
    if not cid: return jsonify({"error": "class_id required"}), 400

    # Fetch class info
    cls = fetchone("SELECT * FROM classes WHERE id=?", (cid,))
    if not cls: return jsonify({"error": "Class not found"}), 404

    # Fetch all enrolled students
    students = fetchall("""SELECT u.roll_no, u.name, u.gender
                             FROM class_students cs JOIN users u ON u.roll_no=cs.student_roll
                             WHERE cs.class_id=? ORDER BY u.name""", (cid,))

    if not students: return jsonify({"error": "No students enrolled"}), 400

    reports = []
    for st in students:
        roll = st["roll_no"]

        # Attendance per subject
        att = fetchall("""SELECT subject,
                                  COUNT(*) as total,
                                  SUM(CASE WHEN status='Present' THEN 1 ELSE 0 END) as present
                           FROM attendance WHERE student_roll=? AND class_id=?
                           GROUP BY subject""", (roll, cid))

        # Marks
        marks = fetchall("""SELECT subject, exam_type,
                                    marks_obtained, marks_total,
                                    ROUND(marks_obtained*100.0/NULLIF(marks_total,0),1) as pct
                             FROM marks WHERE student_roll=? AND class_id=?
                             ORDER BY subject, exam_type""", (roll, cid))

        # Assignments
        total_asgn = fetchone("SELECT COUNT(*) as c FROM assignments WHERE class_id=?", (cid,))["c"]
        submitted  = fetchone("""SELECT COUNT(*) as c FROM submissions s
                                  JOIN assignments a ON a.id=s.assignment_id
                                  WHERE s.student_roll=? AND a.class_id=?""", (roll, cid))["c"]

        # Build data block for AI
        att_lines = []
        overall_att_total = overall_att_present = 0
        for a in att:
            pct = round((a["present"] or 0) / a["total"] * 100, 1) if a["total"] else 0
            status = "✓ Safe" if pct >= 75 else "⚠ Low"
            att_lines.append(f"{a['subject']}: {pct}% ({a['present']}/{a['total']}) {status}")
            overall_att_total   += a["total"]
            overall_att_present += (a["present"] or 0)

        overall_att = round(overall_att_present / overall_att_total * 100, 1) if overall_att_total else 0

        marks_lines = []
        for m in marks:
            marks_lines.append(f"{m['subject']} {m['exam_type']}: {m['marks_obtained']}/{m['marks_total']} ({m['pct']}%)")

        data_block = f"""Student: {st['name']} | Roll: {roll}
Overall Attendance: {overall_att}%
Subject-wise Attendance: {chr(10).join(att_lines) if att_lines else 'No records'}
Marks: {chr(10).join(marks_lines) if marks_lines else 'No marks recorded'}
Assignments Submitted: {submitted}/{total_asgn}"""

        # Also compute MST avg and assignment avg for display and AI context
        subj_map = {}
        for m in marks:
            s = m["subject"]
            if s not in subj_map: subj_map[s] = {}
            subj_map[s][m["exam_type"]] = m["marks_obtained"]

        # Build per-subject mark totals from actual marks records
        subj_totals = {}
        for m in marks:
            subj_totals[m["subject"]] = m["marks_total"]  # use actual total stored

        mst_summary_lines = []
        for s, exs in subj_map.items():
            mt = subj_totals.get(s, 24)
            mst_scores = [v for k,v in exs.items() if k in ("MST1","MST2") and v is not None]
            mst_avg_s  = round(sum(mst_scores)/len(mst_scores),1) if mst_scores else None
            parts = []
            if "MST1" in exs and exs["MST1"] is not None: parts.append(f"MST1={exs['MST1']}/{mt}")
            if "MST2" in exs and exs["MST2"] is not None: parts.append(f"MST2={exs['MST2']}/{mt}")
            if mst_avg_s is not None and len(mst_scores)>1: parts.append(f"Avg={mst_avg_s}/{mt}")
            if parts: mst_summary_lines.append(f"{s}: {', '.join(parts)}")

        # Assignment marks
        asgn_marks_list = fetchall("""SELECT s.marks_obtained, a.title, a.subject
                                       FROM submissions s JOIN assignments a ON a.id=s.assignment_id
                                       WHERE s.student_roll=? AND a.class_id=?
                                       AND s.marks_obtained IS NOT NULL""", (roll, cid))
        asgn_detail = ", ".join(f"{a['subject']} {a['title']}: {a['marks_obtained']}/10" for a in asgn_marks_list) if asgn_marks_list else "None graded yet"

        data_block_full = f"""Student: {st['name']} | Roll: {roll}
Overall Attendance: {overall_att}%  (this is a mid-semester running figure, not final)
Subject-wise Attendance: {chr(10).join(att_lines) if att_lines else 'No records yet'}
MST Marks: {chr(10).join(mst_summary_lines) if mst_summary_lines else 'No exams recorded yet'}
Assignment Marks: {asgn_detail}
Assignments Submitted: {submitted}/{total_asgn}
Note: This is a MID-SEMESTER report. Some exams/assignments may not have occurred yet."""

        prompt = f"""You are writing a mid-semester academic progress report for a college student.
This report is based on data collected SO FAR during the semester — not all exams or assignments may have happened yet.
Write a formal 3-4 sentence remark suitable for a university progress report card.
- Professional tone, like a teacher wrote it
- Reference actual numbers from the data (attendance %, marks scores)
- If only MST1 done, say so — do not pretend MST2 exists
- If no marks yet, focus on attendance and assignment submission
- Do NOT use bullet points — flowing paragraph only
- End with one specific, actionable recommendation

{data_block_full}

Write the progress remark now:"""

        try:
            remark = ask_gemini(prompt)
        except Exception as e:
            err = str(e)
            print(f"[AI ERROR] {type(e).__name__}: {err[:100]}")
            if '429' in err or 'RESOURCE_EXHAUSTED' in err or 'quota' in err.lower():
                remark = "AI quota limit reached. Please try again after some time or check your Gemini API plan at aistudio.google.com"
            else:
                remark = "AI remark unavailable — could not connect to Gemini. Check your API key and internet connection."

        # Calculate overall grade
        all_pcts = [m["pct"] for m in marks if m["pct"] is not None]
        avg_marks = round(sum(all_pcts) / len(all_pcts), 1) if all_pcts else None
        grade = ("O" if avg_marks >= 90 else "A+" if avg_marks >= 80 else
                 "A" if avg_marks >= 70 else "B+" if avg_marks >= 60 else
                 "B" if avg_marks >= 50 else "C" if avg_marks >= 40 else "F") if avg_marks else "—"

        # Compute per-subject MST avg for display
        subj_summaries = []
        for s, exs in subj_map.items():
            mst_scores = [v for k,v in exs.items() if k in ("MST1","MST2") and v is not None]
            mst_avg_s  = round(sum(mst_scores)/len(mst_scores),1) if mst_scores else None
            subj_summaries.append({
                "subject":  s,
                "mst1":     exs.get("MST1"),
                "mst2":     exs.get("MST2"),
                "mst_avg":  mst_avg_s,
                "final":    exs.get("Final"),
            })

        asgn_avg_st = round(sum(a["marks_obtained"] for a in asgn_marks_list)/len(asgn_marks_list),1) if asgn_marks_list else None

        reports.append({
            "roll_no":        roll,
            "name":           st["name"],
            "gender":         st["gender"],
            "attendance":     overall_att,
            "avg_marks":      avg_marks,
            "grade":          grade,
            "submitted":      submitted,
            "total_asgn":     total_asgn,
            "att_detail":     att,
            "marks_detail":   marks,
            "subj_summaries": subj_summaries,
            "asgn_avg":       asgn_avg_st,
            "remark":         remark.strip(),
        })

    return jsonify({
        "class_name": cls["name"],
        "section":    cls.get("section", ""),
        "exam_type":  exam_type,
        "reports":    reports,
        "total":      len(reports)
    }), 200

@ai_bp.route("/progress-report-pdf", methods=["POST"])
@jwt_required()
def progress_report_pdf():
    """Generate a downloadable PDF from progress report data"""
    u = cu()
    if u["role"] != "teacher": return jsonify({"error": "Unauthorized"}), 403
    from flask import send_file, make_response
    import io
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
                                     TableStyle, PageBreak, HRFlowable)
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

    d         = request.get_json()
    reports   = d.get("reports", [])
    cls_name  = d.get("class_name", "Class")
    exam_type = d.get("exam_type", "")

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                            topMargin=15*mm, bottomMargin=15*mm,
                            leftMargin=18*mm, rightMargin=18*mm)

    # Styles
    styles = getSampleStyleSheet()
    title_style   = ParagraphStyle("Title2",   parent=styles["Title"],   fontSize=16, spaceAfter=4, alignment=TA_CENTER)
    sub_style     = ParagraphStyle("Sub",      parent=styles["Normal"],  fontSize=9,  textColor=colors.HexColor("#6b7280"), alignment=TA_CENTER, spaceAfter=10)
    head_style    = ParagraphStyle("Head",     parent=styles["Heading2"],fontSize=11, spaceAfter=4, textColor=colors.HexColor("#1f2937"))
    normal_style  = ParagraphStyle("Norm",     parent=styles["Normal"],  fontSize=9,  leading=14,   textColor=colors.HexColor("#374151"))
    remark_style  = ParagraphStyle("Remark",   parent=styles["Normal"],  fontSize=8.5,leading=13,   textColor=colors.HexColor("#1f2937"),
                                   leftIndent=6, rightIndent=6, italic=True)
    roll_style    = ParagraphStyle("Roll",     parent=styles["Normal"],  fontSize=8,  textColor=colors.HexColor("#9ca3af"), fontFamily="Courier")

    PURPLE = colors.HexColor("#7c3aed")
    GREEN  = colors.HexColor("#16a34a")
    RED    = colors.HexColor("#dc2626")
    GOLD   = colors.HexColor("#d97706")
    GRAY   = colors.HexColor("#f3f4f6")

    story = []

    # Cover header
    story.append(Paragraph("SmartAcademic — Student Progress Report", title_style))
    story.append(Paragraph(f"{cls_name}  ·  {exam_type}  ·  Generated on {__import__('datetime').date.today()}", sub_style))
    story.append(HRFlowable(width="100%", thickness=2, color=PURPLE, spaceAfter=12))

    # Summary table
    total   = len(reports)
    safe    = sum(1 for r in reports if (r.get("attendance") or 0) >= 75)
    at_risk = total - safe
    avg_att = round(sum((r.get("attendance") or 0) for r in reports) / total, 1) if total else 0
    grades  = [r.get("grade","—") for r in reports]
    pass_c  = sum(1 for g in grades if g not in ["F","—"])

    summary_data = [
        ["Total Students", "Attendance Safe", "At Risk", "Avg Attendance", "Passed"],
        [str(total), str(safe), str(at_risk), f"{avg_att}%", str(pass_c)]
    ]
    summary_tbl = Table(summary_data, colWidths=[35*mm]*5)
    summary_tbl.setStyle(TableStyle([
        ("BACKGROUND",  (0,0), (-1,0), PURPLE),
        ("TEXTCOLOR",   (0,0), (-1,0), colors.white),
        ("FONTSIZE",    (0,0), (-1,0), 8),
        ("FONTSIZE",    (0,1), (-1,1), 13),
        ("FONTNAME",    (0,1), (-1,1), "Helvetica-Bold"),
        ("ALIGN",       (0,0), (-1,-1), "CENTER"),
        ("VALIGN",      (0,0), (-1,-1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0,1), (-1,1), [GRAY]),
        ("GRID",        (0,0), (-1,-1), 0.5, colors.HexColor("#e5e7eb")),
        ("TOPPADDING",  (0,0), (-1,-1), 6),
        ("BOTTOMPADDING",(0,0), (-1,-1), 6),
        ("ROUNDEDCORNERS", [4]),
    ]))
    story.append(summary_tbl)
    story.append(Spacer(1, 16))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e5e7eb"), spaceAfter=12))

    # Individual student reports
    for i, r in enumerate(reports):
        att     = r.get("attendance", 0) or 0
        grade   = r.get("grade", "—")
        att_clr = GREEN if att >= 75 else GOLD if att >= 60 else RED

        # Student header row
        header_data = [[
            Paragraph(f"<b>{r['name']}</b>", ParagraphStyle("SH", parent=styles["Normal"], fontSize=11, textColor=colors.HexColor("#111827"))),
            Paragraph(r["roll_no"], ParagraphStyle("SR", parent=styles["Normal"], fontSize=8, textColor=colors.HexColor("#6b7280"), fontName="Courier")),
            Paragraph(f"Att: <b>{att}%</b>", ParagraphStyle("SA", parent=styles["Normal"], fontSize=9, textColor=att_clr, alignment=TA_RIGHT)),
            Paragraph(f"Grade: <b>{grade}</b>", ParagraphStyle("SG", parent=styles["Normal"], fontSize=12, textColor=PURPLE, alignment=TA_RIGHT)),
        ]]
        header_tbl = Table(header_data, colWidths=[75*mm, 40*mm, 30*mm, 25*mm])
        header_tbl.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,0), GRAY),
            ("LEFTPADDING", (0,0), (0,0), 10),
            ("TOPPADDING", (0,0), (-1,0), 8),
            ("BOTTOMPADDING", (0,0), (-1,0), 8),
            ("LINEBELOW", (0,0), (-1,0), 1.5, PURPLE),
        ]))
        story.append(header_tbl)

        # Marks row
        marks = r.get("marks_detail", [])
        if marks:
            marks_cells = []
            for m in marks[:6]:
                pct = m.get("pct") or 0
                clr = GREEN if pct >= 75 else GOLD if pct >= 50 else RED
                marks_cells.append(
                    Paragraph(f"{m['subject']} {m['exam_type']}<br/><b>{m['marks_obtained']}/{m['marks_total']}</b> ({pct}%)",
                              ParagraphStyle("MC", parent=styles["Normal"], fontSize=7.5, leading=11, textColor=clr, alignment=TA_CENTER))
                )
            # Pad to 6 cells
            while len(marks_cells) < 6:
                marks_cells.append(Paragraph("", normal_style))
            marks_tbl = Table([marks_cells], colWidths=[174*mm/min(len(marks),6)]*min(len(marks),6))
            marks_tbl.setStyle(TableStyle([
                ("GRID", (0,0), (-1,-1), 0.5, colors.HexColor("#e5e7eb")),
                ("ALIGN", (0,0), (-1,-1), "CENTER"),
                ("TOPPADDING", (0,0), (-1,-1), 5),
                ("BOTTOMPADDING", (0,0), (-1,-1), 5),
            ]))
            story.append(marks_tbl)

        # AI Remark
        remark = r.get("remark", "").replace("\n", " ")
        remark_para = Paragraph(f'<i>"{remark}"</i>', remark_style)
        remark_box  = Table([[remark_para]], colWidths=[174*mm])
        remark_box.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,-1), colors.HexColor("#faf5ff")),
            ("LEFTPADDING",  (0,0), (-1,-1), 10),
            ("RIGHTPADDING", (0,0), (-1,-1), 10),
            ("TOPPADDING",   (0,0), (-1,-1), 7),
            ("BOTTOMPADDING",(0,0), (-1,-1), 7),
            ("LINERIGHT", (0,0), (0,-1), 3, PURPLE),
        ]))
        story.append(remark_box)
        story.append(Spacer(1, 10))

        # Page break every 3 students
        if (i+1) % 3 == 0 and i < len(reports)-1:
            story.append(PageBreak())
            story.append(Paragraph(f"{cls_name} — Progress Report (continued)", sub_style))
            story.append(Spacer(1, 8))

    doc.build(story)
    buf.seek(0)
    response = make_response(buf.read())
    response.headers["Content-Type"]        = "application/pdf"
    response.headers["Content-Disposition"] = f'attachment; filename="Progress_{cls_name}_{exam_type}.pdf"'
    return response

@ai_bp.route("/papers", methods=["GET"])
@jwt_required()
def papers():
    u=cu()
    if u["role"]!="teacher": return jsonify({"error":"Unauthorized"}),403
    return jsonify(fetchall(
        "SELECT id,subject,class_id,created_at,SUBSTR(content,1,100) AS preview "
        "FROM question_papers WHERE teacher_id=? ORDER BY created_at DESC",(u["roll_no"],))),200

@ai_bp.route("/papers/<int:pid>", methods=["GET","DELETE"])
@jwt_required()
def paper(pid):
    u=cu()
    if u["role"]!="teacher": return jsonify({"error":"Unauthorized"}),403
    if request.method=="DELETE":
        execute("DELETE FROM question_papers WHERE id=? AND teacher_id=?",(pid,u["roll_no"]))
        return jsonify({"message":"Deleted"}),200
    p=fetchone("SELECT * FROM question_papers WHERE id=? AND teacher_id=?",(pid,u["roll_no"]))
    return (jsonify(p),200) if p else (jsonify({"error":"Not found"}),404)