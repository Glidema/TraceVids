# workflow

TraceVids 可运行 CLI + 本地产品壳。完整说明见 **[../README.md](../README.md)**。

```bash
npm install && npx playwright install ffmpeg
cd polish && npm install && cd ..
cp .env.example .env   # 可选 API Key

# 产品壳（推荐）
npm run app
# → http://127.0.0.1:8787

# CLI
npm run agent -- https://example.com --goal "演示核心功能" -o scripts/out.yaml
npm run demo -- --script scripts/formats-to-mp3.yaml --out ./output/transcribe-mp3
```
