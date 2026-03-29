# public/models/

This folder should contain face-api.js model weights for offline face emotion detection.

## Required structure:
```
public/models/
├── tiny_face_detector/
│   ├── weights_manifest.json
│   └── model-shard1
└── face_expression_model/
    ├── weights_manifest.json
    └── model-shard1
```

## How to download:
```bash
cd frontend
bash download_models.sh
```

## If models are NOT here:
The app will automatically fall back to loading models from CDN at runtime.
Face detection will still work — just slightly slower on first load.

## Why local models?
- Works 100% offline (hackathon demo day — no internet needed)
- Faster load time after first run
- No CDN dependency
