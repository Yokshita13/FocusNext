import os
from flask import Flask, jsonify, send_from_directory

from db import init_db
import routes_tasks, routes_goals, routes_sessions, routes_stats

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "frontend"))


def create_app(database=None):
    app = Flask(__name__, static_folder=None)
    app.config["DATABASE"] = database or os.environ.get(
        "DATABASE_PATH", os.path.join(BASE_DIR, "data", "focusnext.db")
    )
    init_db(app)

    for module in (routes_tasks, routes_goals, routes_sessions, routes_stats):
        app.register_blueprint(module.bp)

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok"})

    @app.errorhandler(404)
    def not_found(_e):
        from flask import request
        if request.path.startswith("/api/"):
            return jsonify({"error": "Not found"}), 404
        return send_from_directory(FRONTEND_DIR, "index.html")

    @app.get("/")
    def index():
        return send_from_directory(FRONTEND_DIR, "index.html")

    @app.get("/<path:path>")
    def static_files(path):
        return send_from_directory(FRONTEND_DIR, path)

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=os.environ.get("FLASK_DEBUG") == "1")