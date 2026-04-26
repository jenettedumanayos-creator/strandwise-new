from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

from flask import Flask, jsonify, request

BASE_DIR = Path(__file__).resolve().parent
SCRIPT_PATH = BASE_DIR / "random_forest_classifier.py"
MODEL_PATH = BASE_DIR / "random_forest_model.joblib"
METADATA_PATH = BASE_DIR / "random_forest_metadata.json"

app = Flask(__name__)


def _run_classifier(payload: dict) -> tuple[dict, int]:
    if not SCRIPT_PATH.exists():
        return {"success": False, "message": "Classifier script not found."}, 500

    proc = subprocess.run(
        [sys.executable, str(SCRIPT_PATH)],
        input=json.dumps(payload),
        text=True,
        capture_output=True,
        cwd=str(BASE_DIR.parent),
    )

    if proc.returncode != 0:
        message = proc.stderr.strip() or "Classifier process failed."
        return {
            "success": False,
            "message": message,
            "stdout": proc.stdout,
            "stderr": proc.stderr,
            "exit_code": proc.returncode,
        }, 500

    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError:
        return {
            "success": False,
            "message": "Classifier returned invalid JSON.",
            "stdout": proc.stdout,
            "stderr": proc.stderr,
        }, 500

    return data, 200 if data.get("success") else 400


@app.get("/ml/health")
def health() -> tuple:
    return jsonify(
        {
            "success": True,
            "service": "strandwise-ml-flask",
            "status": "ok",
            "model_exists": MODEL_PATH.exists(),
            "script_exists": SCRIPT_PATH.exists(),
        }
    ), 200


@app.get("/ml/model-info")
def model_info() -> tuple:
    metadata = {}
    if METADATA_PATH.exists():
        try:
            metadata = json.loads(METADATA_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            metadata = {"warning": "Metadata file is not valid JSON."}

    return jsonify(
        {
            "success": True,
            "model_exists": MODEL_PATH.exists(),
            "metadata_exists": METADATA_PATH.exists(),
            "metadata": metadata,
            "paths": {
                "model": str(MODEL_PATH),
                "metadata": str(METADATA_PATH),
                "script": str(SCRIPT_PATH),
            },
        }
    ), 200


@app.post("/ml/train")
def train() -> tuple:
    payload = request.get_json(silent=True) or {}
    payload["action"] = "train"
    payload.setdefault("model_path", str(MODEL_PATH))
    payload.setdefault("metadata_path", str(METADATA_PATH))
    result, status = _run_classifier(payload)
    return jsonify(result), status


@app.post("/ml/predict")
def predict() -> tuple:
    payload = request.get_json(silent=True) or {}
    payload["action"] = "predict"
    payload.setdefault("model_path", str(MODEL_PATH))
    payload.setdefault("metadata_path", str(METADATA_PATH))
    result, status = _run_classifier(payload)
    return jsonify(result), status


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5001, debug=False)
