"""
Wireup — Local Whisper STT server
Runs faster-whisper locally on CPU (or CUDA if available).
Model: base  — good balance of speed vs accuracy, ~145 MB download (cached after first run).
Task: translate → always outputs English regardless of spoken language.

Start: python server.py
Port: 8765
"""

import os
import io
import base64
import tempfile
import traceback

from flask import Flask, request, jsonify
from flask_cors import CORS
from faster_whisper import WhisperModel

# ── Config ────────────────────────────────────────────────────────────────────
MODEL_SIZE  = os.environ.get("WHISPER_MODEL", "base")   # tiny | base | small | medium | large-v3
DEVICE      = os.environ.get("WHISPER_DEVICE", "cpu")   # cpu | cuda
COMPUTE     = os.environ.get("WHISPER_COMPUTE", "int8") # int8 (cpu) | float16 (cuda)
PORT        = int(os.environ.get("WHISPER_PORT", 8765))

# ── Load model once at startup ────────────────────────────────────────────────
print(f"[Whisper] Loading model '{MODEL_SIZE}' on {DEVICE} ({COMPUTE})…")
model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE)
print("[Whisper] Model ready.")

app = Flask(__name__)
CORS(app)  # allow Node backend to call this

# ── Health ────────────────────────────────────────────────────────────────────
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"ok": True, "model": MODEL_SIZE, "device": DEVICE})

# ── Transcribe ────────────────────────────────────────────────────────────────
@app.route("/transcribe", methods=["POST"])
def transcribe():
    try:
        body = request.get_json(force=True)
        if not body or "audioBase64" not in body:
            return jsonify({"error": "audioBase64 is required"}), 400

        audio_b64  = body["audioBase64"]
        audio_bytes = base64.b64decode(audio_b64)

        if len(audio_bytes) == 0:
            return jsonify({"error": "Empty audio payload"}), 400

        # Write to a temp file — faster-whisper reads from a file path
        suffix = ".webm"
        mime = body.get("mimeType", "audio/webm")
        if "ogg"  in mime: suffix = ".ogg"
        elif "mp4" in mime: suffix = ".mp4"
        elif "wav" in mime: suffix = ".wav"

        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        try:
            # task="translate" → transcribes AND translates everything to English
            segments, info = model.transcribe(
                tmp_path,
                task="translate",
                beam_size=5,
                vad_filter=True,          # skip silent segments
                vad_parameters={"min_silence_duration_ms": 500},
            )
            transcript = " ".join(seg.text.strip() for seg in segments).strip()
            detected   = info.language
        finally:
            os.unlink(tmp_path)

        return jsonify({
            "transcript":       transcript,
            "detectedLanguage": detected,
            "model":            MODEL_SIZE,
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# ── Entry ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print(f"[Whisper] Server running on http://localhost:{PORT}")
    app.run(host="0.0.0.0", port=PORT, debug=False)
