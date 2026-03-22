import os
from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_bcrypt import Bcrypt
from dotenv import load_dotenv
from database import init_db

load_dotenv()

def create_app():
    app = Flask(__name__)
    app.config["JWT_SECRET_KEY"]     = os.getenv("JWT_SECRET_KEY", "sas-secret-2026-change-me")
    app.config["UPLOAD_FOLDER"]      = os.path.join(os.path.dirname(__file__), "uploads")
    app.config["MAX_CONTENT_LENGTH"] = 32 * 1024 * 1024
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    # Allow all origins — required for Vercel → Railway
    CORS(app, origins=["*"], supports_credentials=False,
         allow_headers=["Content-Type", "Authorization"])
    JWTManager(app)
    Bcrypt(app)

    from routes.auth          import auth_bp
    from routes.classes       import classes_bp
    from routes.attendance    import attendance_bp
    from routes.assignments   import assignments_bp
    from routes.notes         import notes_bp
    from routes.announcements import announcements_bp
    from routes.timetable     import timetable_bp
    from routes.exams         import exams_bp
    from routes.marks         import marks_bp
    from routes.forum         import forum_bp
    from routes.availability  import availability_bp
    from routes.analytics     import analytics_bp
    from routes.ai            import ai_bp

    app.register_blueprint(auth_bp,          url_prefix="/api/auth")
    app.register_blueprint(classes_bp,       url_prefix="/api/classes")
    app.register_blueprint(attendance_bp,    url_prefix="/api/attendance")
    app.register_blueprint(assignments_bp,   url_prefix="/api/assignments")
    app.register_blueprint(notes_bp,         url_prefix="/api/notes")
    app.register_blueprint(announcements_bp, url_prefix="/api/announcements")
    app.register_blueprint(timetable_bp,     url_prefix="/api/timetable")
    app.register_blueprint(exams_bp,         url_prefix="/api/exams")
    app.register_blueprint(marks_bp,         url_prefix="/api/marks")
    app.register_blueprint(forum_bp,         url_prefix="/api/forum")
    app.register_blueprint(availability_bp,  url_prefix="/api/availability")
    app.register_blueprint(analytics_bp,     url_prefix="/api/analytics")
    app.register_blueprint(ai_bp,            url_prefix="/api/ai")

    # Optional: smart attendance (requires face_recognition)
    try:
        from routes.smart_attendance import smart_bp
        app.register_blueprint(smart_bp, url_prefix="/api/smart")
    except ImportError:
        pass

    # Optional: productivity
    try:
        from routes.productivity import productivity_bp
        app.register_blueprint(productivity_bp, url_prefix="/api/productivity")
    except ImportError:
        pass

    @app.route("/api/health")
    def health():
        return {"status": "ok", "version": "3.0",
                "db": "pg" if __import__('database').USE_PG else "sqlite"}

    init_db()
    try:
        from database import init_smart_tables; init_smart_tables()
    except: pass
    try:
        from database import init_automation_tables; init_automation_tables()
    except: pass
    try:
        from database import init_new_feature_tables; init_new_feature_tables()
    except: pass
    try:
        from database import init_extra_tables; init_extra_tables()
    except: pass

    # Start automation engine (background jobs)
    try:
        from automation import start_scheduler
        start_scheduler(app)
    except Exception:
        pass

    # Manual automation trigger (for demo)
    from flask import jsonify as _j
    @app.route("/api/automation/run-now", methods=["POST"])
    def trigger_automation():
        try:
            from automation import run_all_now
            return _j({"message": "Done", "results": run_all_now()}), 200
        except Exception as e:
            return _j({"error": str(e)}), 500

    return app

if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, port=5000, host="0.0.0.0")