# Training a muzzle-specific AI model

The app ships with a general pretrained model (DINOv2-small) that has never seen cattle muzzles.
Accuracy only becomes trustworthy once the model is fine-tuned on real muzzle photos.

1. **Collect data**: 30+ animals, 4+ photos each, taken on different days, angles and lighting, laid out as
   `data/<animal_id>/*.jpg`. More animals matter more than more photos per animal.
2. **Train**: `python training/train_embedder.py --data data --out runs/muzzle-dinov2`
   It prints held-out rank-1 and verification error each epoch. Held-out photos are never trained on.
   Judge the model by those numbers, not by training loss. For a stricter test, hold out whole days or whole animals.
3. **Export for the browser**:
   ```
   pip install optimum[onnxruntime]
   optimum-cli export onnx --model runs/muzzle-dinov2 --task feature-extraction runs/muzzle-onnx
   ```
   then put the model in the layout transformers.js expects (`config.json`, `preprocessor_config.json`,
   `onnx/model_quantized.onnx`) in a Hugging Face repo or on your own static host.
4. **Use it**: set `VITE_EMBED_MODEL=<your-repo-or-path>` in `.env`, rebuild.
   Re-enrol animals afterwards: embeddings from different models are not comparable.
