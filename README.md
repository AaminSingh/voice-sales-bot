# VoiceSales AI

An AI-powered voice sales bot web application designed to conduct natural sales conversations, handle customer objections in real time, and record call history.

Built as an intern assignment using **Next.js (App Router)**, **TypeScript**, and **Tailwind CSS**.

---

## 🚀 Features (Project Setup & Layout)

- **Call Screen (`/`)**: Main interactive call interface with real-time call status indicators, call duration timer, conversation transcript panel, and call control buttons.
- **Call History (`/history`)**: Call logs view with an empty-state screen for past call reviews.
- **Responsive Navigation**: Reusable Navbar with active link detection and mobile drawer support.
- **Product Sheet (`src/data/product.ts`)**: Structured product knowledge base for **BillEasy** (a SaaS billing & invoicing tool for SMEs), complete with features, INR pricing plans, objection handlers, and calls to action.
- **Configured Environment Variables**: Placeholder configuration for Google Gemini API and Supabase database.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, `src/` directory, `@/*` path alias)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons**: SVG icons

---

## 📦 Getting Started

### 1. Prerequisites
- Node.js 18.18.0 or newer
- npm (or yarn / pnpm / bun)

### 2. Installation
Clone the repository and install dependencies:

```bash
git clone <your-repository-url>
cd voice-sales-bot
npm install
```

### 3. Environment Setup
Copy the example environment file and fill in your keys when ready:

```bash
cp .env.example .env.local
```

The required variables are:
- `GEMINI_API_KEY`: API key for Google Gemini Live / AI logic.
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase public anon key.

### 4. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

### 5. Production Build
To test the production build:

```bash
npm run build
npm run start
```

---

## 📁 Project Structure

```
├── .env.example          # Environment variables template
├── .env.local            # Local environment variables (git-ignored)
├── .gitignore            # Git ignore configuration
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── src/
│   ├── app/
│   │   ├── globals.css   # Global Tailwind CSS styles
│   │   ├── layout.tsx    # Root layout with Navbar and metadata
│   │   ├── page.tsx      # Call Screen (/)
│   │   └── history/
│   │       └── page.tsx  # Call History page (/history)
│   ├── components/
│   │   └── Navbar.tsx    # Responsive navigation bar
│   └── data/
│       └── product.ts    # Product sheet for BillEasy SaaS
└── README.md             # Project documentation
```
