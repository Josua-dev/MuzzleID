"""
Fine-tune a vision transformer so photos of the SAME cattle muzzle land close together and different
animals land far apart (metric learning). This is the step that turns the generic pretrained model into a
real muzzle-recognition model.  NOT RUN in the sandbox where it was written (no GPU, no dataset) - test on a
small subset first.

Dataset layout (one folder per animal, >= 4 photos each, ideally from different days/angles/lighting):
    data/
      animal_001/ a.jpg b.jpg c.jpg ...
      animal_002/ ...

    pip install torch torchvision transformers pillow numpy
    python training/train_embedder.py --data data --out runs/muzzle-dinov2 --epochs 15
"""
import argparse, os, random
from pathlib import Path
import numpy as np, torch, torch.nn.functional as F
from PIL import Image
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms as T
from transformers import AutoModel

p = argparse.ArgumentParser()
p.add_argument("--data", required=True); p.add_argument("--out", default="runs/muzzle")
p.add_argument("--base", default="facebook/dinov2-small")
p.add_argument("--epochs", type=int, default=15); p.add_argument("--lr", type=float, default=2e-5)
p.add_argument("--per_class", type=int, default=4); p.add_argument("--classes_per_batch", type=int, default=12)
p.add_argument("--size", type=int, default=224); p.add_argument("--holdout", type=float, default=0.25)
a = p.parse_args()
dev = "cuda" if torch.cuda.is_available() else "cpu"
random.seed(0); torch.manual_seed(0)

# ---- data: split PHOTOS of each animal into train / held-out (held-out photos are never trained on) ----
train_imgs, test_imgs = {}, {}
for d in sorted(Path(a.data).iterdir()):
    fs = sorted(f for f in d.iterdir() if f.suffix.lower() in {".jpg", ".jpeg", ".png"})
    if len(fs) < 4: continue
    random.shuffle(fs); k = max(1, int(len(fs) * a.holdout))
    test_imgs[d.name], train_imgs[d.name] = fs[:k], fs[k:]
ids = sorted(train_imgs); print(f"{len(ids)} animals")
norm = T.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
aug = T.Compose([T.RandomResizedCrop(a.size, scale=(0.55, 1.0), ratio=(0.8, 1.25)), T.RandomRotation(25),
                 T.RandomPerspective(0.35, p=0.7), T.ColorJitter(0.5, 0.5, 0.4, 0.05),
                 T.RandomApply([T.GaussianBlur(5, (0.1, 2.0))], p=0.4), T.ToTensor(), norm])
plain = T.Compose([T.Resize((a.size, a.size)), T.ToTensor(), norm])

class Episodes(Dataset):  # each item = per_class augmented views of one animal
    def __len__(self): return len(ids) * 8
    def __getitem__(self, i):
        c = ids[i % len(ids)]; fs = random.choices(train_imgs[c], k=a.per_class)
        return torch.stack([aug(Image.open(f).convert("RGB")) for f in fs]), i % len(ids)

model = AutoModel.from_pretrained(a.base).to(dev)

def embed(x):  # identical recipe to src/services/biometric/aiEmbedding.ts: cls + mean(patches), L2-normalised
    h = model(pixel_values=x).last_hidden_state
    cls, mean = F.normalize(h[:, 0], dim=-1), F.normalize(h[:, 1:].mean(1), dim=-1)
    return F.normalize(torch.cat([cls, mean], -1), dim=-1)

def supcon(z, y, t=0.07):  # supervised contrastive loss
    sim = z @ z.T / t; n = len(y)
    eye = torch.eye(n, device=z.device, dtype=torch.bool)
    pos = (y[:, None] == y[None, :]) & ~eye
    logp = sim - torch.logsumexp(sim.masked_fill(eye, -1e9), 1, keepdim=True)
    return -(logp * pos).sum(1).div(pos.sum(1).clamp(min=1)).mean()

@torch.no_grad()
def evaluate():
    model.eval(); E, L = [], []
    for ci, c in enumerate(ids):
        for f in test_imgs[c]:
            E.append(embed(plain(Image.open(f).convert("RGB"))[None].to(dev)).cpu()); L.append(ci)
    E = torch.cat(E); L = torch.tensor(L); S = E @ E.T; S.fill_diagonal_(-2)
    rank1 = (L[S.argmax(1)] == L).float().mean().item()
    same = (L[:, None] == L[None, :]); iu = torch.triu(torch.ones_like(S, dtype=torch.bool), 1)
    g, i = S[same & iu], S[~same & iu]
    best = min(((i >= th).float().mean() + (g < th).float().mean()) / 2 for th in torch.linspace(-0.2, 1, 121))
    print(f"  held-out rank-1={rank1:.3f}  verification EER~{best:.3f}  (genuine pairs={len(g)}, impostor pairs={len(i)})")
    model.train(); return rank1

opt = torch.optim.AdamW(model.parameters(), lr=a.lr, weight_decay=0.05)
best = 0
for ep in range(a.epochs):
    model.train(); tot = 0
    dl = DataLoader(Episodes(), batch_size=a.classes_per_batch, shuffle=True, num_workers=2, drop_last=True)
    for x, y in dl:
        x = x.flatten(0, 1).to(dev); y = y.repeat_interleave(a.per_class).to(dev)
        loss = supcon(embed(x), y); opt.zero_grad(); loss.backward(); opt.step(); tot += loss.item()
    print(f"epoch {ep+1}/{a.epochs} loss {tot/len(dl):.4f}"); r = evaluate()
    if r >= best: best = r; os.makedirs(a.out, exist_ok=True); model.save_pretrained(a.out); print("  saved")
print("best held-out rank-1:", best)
