# ReviewLens

An AI-powered review intelligence tool built with Node.js/Express, React/Vite, and the Gemini API.

## Project Structure
- `/server`: Express backend (ESM)
- `/client`: React + Vite frontend
- `/data`: Sample datasets and review files

## Setup
1. Copy `.env.example` to `.env` and configure `GEMINI_API_KEY`:
   ```bash
   cp .env.example .env
   ```
2. Install dependencies:
   ```bash
   npm run install:all
   ```
3. Run development mode (both server and client):
   ```bash
   npm run dev
   ```
