# ProTracker - AI-Powered Production Tracker

[🇺🇸 English](README.md) | [🇨🇳 简体中文](README_ZH.md)

> 🤖 **V6.0.0 New Features**: Floating AI Assistant, Smart Navigation, Role-Based Security, and Advanced Log Management.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Add your OpenAI API Key to the `.env` file:
```
OPENAI_API_KEY=sk-your-api-key-here
```

### 3. Start Development Server
```bash
npm run dev
```

Visit http://localhost:3000

---

## ✨ AI Features (v6.0.0)

### 💬 Floating AI Assistant
A specialized production assistant that helps you:
- **Analyze Risks**: "Which orders are likely to be delayed?"
- **Generate Morning Reports**: "Prepare a summary for the morning meeting."
- **Smart Navigation**: "Show me WO-1234" -> *Auto-opens order details*.

### 🛡️ AI Guardrails
The AI is strictly scoped to production topics. It will refuse non-work-related queries (e.g., jokes, weather) to ensure professional use.

---

## 🔒 Security & Management

### Role-Based Access
- **Admin**: Full access + AI Risk Analysis + Log Clearing.
- **Supervisor**: Management + AI Reports.
- **User**: Operation View + Basic Chat.

### 📊 Log Management
- **CSV Export**: Download comprehensive operation logs.
- **Clear Logs**: Admin-only function to reset history.

---

## 📝 Changelog

### V6.0.0
- ✨ **Floating AI Assistant**: New UI with persistent chat.
- 🧭 **Smart Navigation**: Navigate to orders via chat commands.
- 🛡️ **Role-Based AI**: Restricted advanced tools to Admin/Supervisor.
- 📊 **Log Management**: CSV Export and Clear Logs features.
- 🔒 **AI Guardrails**: Strict scope enforcement.

### V5.0.0
- Added initial AI Chat functionality.
- Integrated OpenAI GPT-4o-mini.

---

