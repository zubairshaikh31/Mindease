#!/bin/bash
# download_models.sh
# Run this once to download face-api.js models into public/models/
# Required folder structure:
#   public/models/tiny_face_detector/
#   public/models/face_expression/

echo "🌿 MindEase — Downloading face-api.js models..."

BASE="https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights"
OUT="public/models"

mkdir -p "$OUT/tiny_face_detector"
mkdir -p "$OUT/face_expression_model"

# Tiny Face Detector
echo "📥 Downloading tiny_face_detector..."
curl -sL "$BASE/tiny_face_detector_model-weights_manifest.json" -o "$OUT/tiny_face_detector/weights_manifest.json"
curl -sL "$BASE/tiny_face_detector_model-shard1"                -o "$OUT/tiny_face_detector/model-shard1"

# Face Expression Net
echo "📥 Downloading face_expression_model..."
curl -sL "$BASE/face_expression_recognizer_model-weights_manifest.json" -o "$OUT/face_expression_model/weights_manifest.json"
curl -sL "$BASE/face_expression_recognizer_model-shard1"                 -o "$OUT/face_expression_model/model-shard1"

echo ""
echo "✅ Models downloaded to public/models/"
echo "   If this fails (no curl), the app will automatically"
echo "   fall back to loading models from CDN at runtime."
echo ""
echo "📁 Structure:"
ls -la "$OUT/tiny_face_detector/" 2>/dev/null || echo "  (tiny_face_detector not found)"
ls -la "$OUT/face_expression_model/" 2>/dev/null || echo "  (face_expression_model not found)"
