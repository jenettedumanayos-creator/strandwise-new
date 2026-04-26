import json
import sys
from collections import Counter
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split

DEFAULT_FEATURE_NAMES = ["STEM", "ABM", "HUMSS", "TVL", "GAS"]


def emit(payload, exit_code=0):
    sys.stdout.write(json.dumps(payload, ensure_ascii=False))
    sys.exit(exit_code)


def read_payload():
    raw = sys.stdin.read()
    if not raw.strip():
        raise ValueError("Missing JSON payload")
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError("Payload must be a JSON object")
    return data


def get_paths(payload):
    base_dir = Path(payload.get("base_dir") or Path(__file__).resolve().parent)
    model_path = Path(payload.get("model_path") or base_dir / "random_forest_model.joblib")
    metadata_path = Path(payload.get("metadata_path") or base_dir / "random_forest_metadata.json")
    return base_dir, model_path, metadata_path


def normalize_features(sample, feature_names):
    features = sample.get("features")
    if isinstance(features, dict):
        return [float(features.get(name, 0.0) or 0.0) for name in feature_names]
    if isinstance(features, list):
        vector = [float(value or 0.0) for value in features]
        if len(vector) != len(feature_names):
            raise ValueError("Feature vector length does not match feature names")
        return vector
    raise ValueError("Each sample must include features as a list or object")


def train_model(payload):
    samples = payload.get("samples") or []
    feature_names = payload.get("feature_names") or DEFAULT_FEATURE_NAMES
    if not isinstance(samples, list) or not samples:
        raise ValueError("No training samples supplied")

    X = []
    y = []
    for sample in samples:
        if not isinstance(sample, dict):
            continue
        label = str(sample.get("label") or "").strip()
        if not label:
            continue
        X.append(normalize_features(sample, feature_names))
        y.append(label)

    if len(X) < 2:
        raise ValueError("Need at least two training samples")

    class_counts = Counter(y)
    if len(class_counts) < 2:
        raise ValueError("Need at least two strand classes to train a classifier")

    base_dir, model_path, metadata_path = get_paths(payload)
    base_dir.mkdir(parents=True, exist_ok=True)
    model_path.parent.mkdir(parents=True, exist_ok=True)
    metadata_path.parent.mkdir(parents=True, exist_ok=True)

    evaluation_mode = "training"
    accuracy = 0.0
    model = RandomForestClassifier(
        n_estimators=int(payload.get("n_estimators") or 200),
        random_state=int(payload.get("random_state") or 42),
        class_weight="balanced",
        max_depth=payload.get("max_depth"),
        min_samples_leaf=int(payload.get("min_samples_leaf") or 1),
    )

    can_holdout = len(X) >= 12 and min(class_counts.values()) >= 2
    if can_holdout:
        try:
            X_train, X_test, y_train, y_test = train_test_split(
                X,
                y,
                test_size=0.25,
                random_state=int(payload.get("random_state") or 42),
                stratify=y,
            )
            model.fit(X_train, y_train)
            predictions = model.predict(X_test)
            accuracy = float(accuracy_score(y_test, predictions) * 100.0)
            evaluation_mode = "holdout"
        except ValueError:
            model.fit(X, y)
            accuracy = float(model.score(X, y) * 100.0)
            evaluation_mode = "training"
    else:
        model.fit(X, y)
        accuracy = float(model.score(X, y) * 100.0)
        evaluation_mode = "training"

    joblib.dump(model, model_path)

    metadata = {
        "algorithm": "Random Forest Classifier",
        "feature_names": feature_names,
        "samples_used": len(X),
        "class_coverage": len(class_counts),
        "class_distribution": dict(class_counts),
        "accuracy_score": round(accuracy, 2),
        "evaluation_mode": evaluation_mode,
    }
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")

    emit(
        {
            "success": True,
            "action": "train",
            "model_path": str(model_path),
            "metadata_path": str(metadata_path),
            "accuracy_score": round(accuracy, 2),
            "samples_used": len(X),
            "class_coverage": len(class_counts),
            "class_distribution": dict(class_counts),
            "evaluation_mode": evaluation_mode,
        }
    )


def predict_model(payload):
    base_dir, model_path, metadata_path = get_paths(payload)
    if not model_path.exists():
        raise ValueError("Trained Random Forest model not found")

    model = joblib.load(model_path)
    feature_names = payload.get("feature_names") or DEFAULT_FEATURE_NAMES
    features = payload.get("features")
    if isinstance(features, dict):
        vector = [float(features.get(name, 0.0) or 0.0) for name in feature_names]
    elif isinstance(features, list):
        vector = [float(value or 0.0) for value in features]
    else:
        raise ValueError("Prediction payload must include features as a list or object")

    if len(vector) != len(feature_names):
        raise ValueError("Feature vector length does not match feature names")

    probabilities = model.predict_proba([vector])[0]
    classes = list(model.classes_)
    top_index = int(np.argmax(probabilities))
    predicted = str(classes[top_index])
    confidence = float(probabilities[top_index] * 100.0)
    class_probabilities = {
        str(label): round(float(probabilities[index] * 100.0), 2)
        for index, label in enumerate(classes)
    }

    metadata = {}
    if metadata_path.exists():
        try:
            metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            metadata = {}

    emit(
        {
            "success": True,
            "action": "predict",
            "predicted_strand": predicted,
            "confidence_score": round(confidence, 2),
            "class_probabilities": class_probabilities,
            "model_path": str(model_path),
            "metadata": metadata,
        }
    )


def main():
    try:
        payload = read_payload()
        action = str(payload.get("action") or "train").lower().strip()
        if action == "predict":
            predict_model(payload)
        else:
            train_model(payload)
    except Exception as exc:
        emit({"success": False, "message": str(exc)}, exit_code=1)


if __name__ == "__main__":
    main()
