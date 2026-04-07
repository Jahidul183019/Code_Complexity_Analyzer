# Code Complexity Analyzer — TC & SC Predictor

Paste C/C++ code and instantly get Big-O time & space complexity with step-by-step explanations. Powered by Google Gemini.

## Features

- **Paste or upload** C/C++ source files
- **Time & Space Complexity** prediction with confidence score
- **Step-by-step explanations** of how complexity was derived
- **Loop, recursion & STL** detection
- **Compare mode** — analyze two snippets side-by-side
- **Optimization suggestions**

## Quick Start (Local)

```bash
# 1. Clone / unzip the project
cd code-complexity-analyzer

# 2. Install dependencies
npm install

# 3. Add your Gemini API key
cp .env.example .env.local
# Edit .env.local and paste your key

# 4. Run
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

### Option A — Via GitHub (recommended)

1. Push this repo to GitHub
2. Go to [vercel.com/new](https://vercel.com/new) → Import repository
3. Add environment variable:
   - **Name:** `GEMINI_API_KEY`
   - **Value:** your key from [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
4. Click **Deploy**

### Option B — Via Vercel CLI

```bash
npm i -g vercel
vercel          # follow prompts
vercel --prod   # deploy to production
```

Set the env var either during the CLI prompts or in the Vercel dashboard under **Settings → Environment Variables**.

Optional model override:
- `GEMINI_MODEL` (default: `gemini-2.0-flash`)

## Project Structure

```
├── app/
│   ├── api/
│   │   └── analyze/
│   │       └── route.js      # Server-side API → calls Gemini
│   ├── globals.css
│   ├── layout.js
│   └── page.js               # Client UI
├── .env.example
├── next.config.js
├── package.json
└── README.md
```

## Limitations

- Analysis is AI/heuristic-based, not formal proof
- Amortized complexity and branch-dependent paths may not be fully captured
- Currently focused on C/C++ (extensible by modifying the system prompt)

## License

MIT
