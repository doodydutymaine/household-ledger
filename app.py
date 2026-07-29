import json
import os
from datetime import datetime
from flask import Flask, jsonify, request, send_from_directory

app = Flask(__name__, static_folder="static", template_folder="templates")

DATA_DIR = os.environ.get("DATA_DIR", "/data")
DATA_FILE = os.path.join(DATA_DIR, "budget.json")

DEFAULT_STATE = {
    "earners": [
        {"id": "e1", "name": "Earner 1", "hours": 160, "rate": 25, "otThreshold": 160,
         "otMultiplier": 1.5, "taxRate": 0.25},
        {"id": "e2", "name": "Earner 2", "hours": 160, "rate": 25, "otThreshold": 160,
         "otMultiplier": 1.5, "taxRate": 0.25},
    ],
    "expenses": [
        {"id": "x1", "name": "Rent/Mortgage", "amount": 0},
        {"id": "x2", "name": "Power", "amount": 0},
        {"id": "x3", "name": "Water", "amount": 0},
        {"id": "x4", "name": "Internet", "amount": 0},
        {"id": "x5", "name": "Food", "amount": 0},
        {"id": "x6", "name": "Insurance", "amount": 0},
    ],
    "car": {
        "enabled": True,
        "label": "Car",
        "payment": 0,
        "milesPerDay": 0,
        "daysPerWeek": 5,
        "weeksPerMonth": 4,
        "mpg": 30,
        "costPerGallon": 3.50,
    },
    "creditCards": [
        {"id": "c1", "name": "Card 1", "balance": 0, "apr": 0.20, "payoffMonths": 24},
    ],
    "forecast": {
        "startingSavings": 0,
        "targetMonth": "",
        "adjustments": [],
    },
}


def ensure_data_dir():
    os.makedirs(DATA_DIR, exist_ok=True)


def load_state():
    ensure_data_dir()
    if not os.path.exists(DATA_FILE):
        return DEFAULT_STATE
    try:
        with open(DATA_FILE, "r") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return DEFAULT_STATE


def save_state(state):
    ensure_data_dir()
    tmp_path = DATA_FILE + ".tmp"
    with open(tmp_path, "w") as f:
        json.dump(state, f, indent=2)
    os.replace(tmp_path, DATA_FILE)


@app.route("/")
def index():
    return send_from_directory("templates", "index.html")


@app.route("/api/state", methods=["GET"])
def get_state():
    return jsonify(load_state())


@app.route("/api/state", methods=["POST"])
def post_state():
    body = request.get_json(force=True, silent=True)
    if body is None:
        return jsonify({"error": "invalid json"}), 400
    save_state(body)
    return jsonify({"ok": True, "savedAt": datetime.utcnow().isoformat() + "Z"})


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    ensure_data_dir()
    app.run(host="0.0.0.0", port=5008)
