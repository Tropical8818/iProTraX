# iProTraX (formerly ProTracker)

## 🚀 Introduction
**iProTraX** is an AI-powered production tracking system that bridges the gap between rigid ERP systems and the dynamic shop floor.

[🇺🇸 English](README.md) | [🇨🇳 简体中文](README_ZH.md)

## 🎯 The Problem
In modern high-mix manufacturing, relying solely on heavy ERP systems like **SAP** or **ME POD** creates critical operational gaps:

1.  **System Rigidity**: SAP is powerful but inflexible. It cannot adapt quickly to the fluid reality of the shop floor (machine breakdowns, urgent re-prioritization).
2.  **Data Lag**: ME POD data often has a synchronization delay when importing to SAP. This means the "System Truth" (SAP) is often hours behind the "Ground Truth" (Shop Floor).
3.  **Invisible Steps**: Operational steps often get skipped or not recorded in SAP due to complexity, causing orders to appear "stuck" in the wrong status.
4.  **The "Black Box" Effect**: Planners and Supervisors cannot see real-time progress. They rely on:
    *   Manual spreadsheets (siloed data).
    *   Social media/chat apps for updates (unprofessional, hard to track).
    *   Human memory (prone to error).

**Result**: You cannot precisely schedule manpower or machines because you don't know the *actual* state of the floor.



iProTraX is not a replacement for SAP. It is the **Agile Collaboration Layer** that sits between your heavy ERP and your agile teams.

It provides a lightweight, real-time visual interface that:
*   **Visualizes the Invisible**: Tracks the micro-steps and real-time status that SAP misses.
*   **Empowers "Super Edit"**: Allows Supervisors to correct data instantly (e.g., bypassing a "stuck" step) without waiting for IT tickets.
*   **Kiosk Mode**: Replaces "asking via WhatsApp" with large, auto-updating shop floor monitors.
*   **AI-Driven Insights**: A built-in AI assistant that analyzes risk and generates reports, replacing manual data crunching.

```mermaid
flowchart TB
 subgraph RigidERP["Rigid ERP"]
        SAP["SAP / ME POD"]
  end
 subgraph DynamicShop["Dynamic Shop Floor"]
        Worker["Mobile Worker (Frontline)"]
        Kiosk["Kiosk Display (Dashboard)"]
  end
 subgraph AgileCore["Agile Collaboration Layer"]
        App["iProTraX Core"]
        Scheduler["Smart Scheduler
        (Autopilot / Auto-Flow)"]
        DB[("Real-time DB")]
        AI["AI Copilot (DeepSeek/GPT)"]
  end
 subgraph DecisionMakers["Decision Makers"]
        Supervisor["Supervisor"]
        Admin["Admin"]
  end
    SAP -- "1. Auto-Import Orders" --> App
    Worker -- "2. Track Time & Output" --> App
    App -- "3. Live Progress & Efficiency" --> Kiosk
    App <--> DB
    App <--> AI
    AI -- "4. Bottleneck Analysis" --> Supervisor
    App -- "5. Efficiency Reports" --> Supervisor
    App -.->|Webhooks| ExternalApps["External Apps (DingTalk/Slack/Telegram)"]
    Supervisor -- "6. Autopilot Planning" --> Scheduler
    Scheduler -- "7. Optimized Schedule" --> App
    Supervisor -- "8. Shift Planning" --> Worker
    Worker -- "9. Smart Comments" --> Supervisor
    App -- "10. Audit Logs" --> Admin
    Supervisor -. "11. Reconciliation" .-> SAP
    ExternalApps -- "12. Query/Update" --> App
    
     SAP:::sap
     Worker:::shop
     Kiosk:::shop
     App:::core
     Scheduler:::ai
     DB:::core
     AI:::ai
     Supervisor:::manage
     Admin:::manage
     ExternalApps:::core
     
    classDef sap fill:#1e3a8a,stroke:#333,stroke-width:2px,color:white
    classDef core fill:#4f46e5,stroke:#333,stroke-width:2px,color:white
    classDef shop fill:#f59e0b,stroke:#333,stroke-width:2px,color:black
    classDef manage fill:#059669,stroke:#333,stroke-width:2px,color:white
    classDef ai fill:#db2777,stroke:#333,stroke-width:2px,color:white
```

---

## 🚀 Quick Start
### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Add your OpenAI API Key to the `.env` file:
```
OPENAI_API_KEY=sk-your-api-key-here
LICENSE_KEY=your-license-key-here  # Optional: Leave empty for Free Tier (1 Line, 10 Users)
```

### 3. Start Development Server
```bash
npm run dev
```
Visit http://localhost:3001

### 4. Default Credentials
After the initial deployment, use the following credentials to access the **SuperAdmin** account:

*   **Employee ID (UserID)**: `SUPER001`
*   **Default Password**: `superadmin123`

> [!IMPORTANT]
> For security, it is highly recommended to change this password immediately after your first login via the User Management settings.

---

## ✨ Key Capabilities

### 1. 🖥️ Shop Floor Kiosk (The "Control Tower")
*   **Purpose**: Replaces social media updates. A passive, always-on monitor for the floor.
*   **Features**:
    *   **Auto-Scroll & Refresh**: No mouse needed. Cycles through active orders.
    *   **Visual Priority**: Color-coded status (WIP, HOLD, QN) for instant awareness.
    *   **Privacy & Security**: Locked down mode with password-protected admin access.

### 2. ✏️ Super Edit Mode (Agile Correction)
*   **Purpose**: Fix "SAP Lag" and "Missing Steps" instantly.
*   **Features**:
    *   **Direct Manipulation**: Supervisors can "force" a step to complete or correction data directly in the UI.
    *   **Optimistic UI**: No waiting for server round-trips; changes feel instant.
    *   **Audit Trail**: Every change is logged, ensuring accountability while allowing flexibility.

### 3. 🤖 AI Copilot (The "Digital Planner")
*   **Purpose**: Augment human decision making.
*   **Features**:
    *   **Risk Analysis**: "Which orders are stuck in WIP for >24h?"
    *   **Context Aware**: Knows your specific product lines and terminology. Supports DeepSeek (China).
    *   **Smart Comments**: Tracks discussions per-step, allowing precise problem-solving directly in the flow.
    *   **Zero-Wait Auto-Flow**: Automatically schedules the next step immediately upon completion, minimizing idle time (Pull System).

### 4. ⏱️ Productivity Engine (Efficiency Loop)
*   **Purpose**: Quantify worker output and efficiency, eliminating guesswork.
*   **Features**:
    *   **Active Session Cards**: Integrated view for workers with **live timer**, **progress bar**, and **standard time (Std)** reference.
    *   **Compact Stop**: One-click quick stop with strict quantity validation/limits.
    *   **Standard Time Mgmt**: Admin configurable standard times (HH:MM) and target quantities per step.
    *   **Efficiency Analytics**: Supervisor-exclusive dashboard showing daily output heatmaps and efficiency rankings.

### 5. ⚡ Real-time Engine (Redis)
*   **Purpose**: Zero-latency collaboration.
*   **Features**:
    *   **Instant Sync**: Updates appear on all screens (Kiosk, Dashboard) effectively instantly (<50ms).
    *   **No Polling**: Replaced old "refresh every minute" mechanism with efficient Server-Sent Events.

### 6. 🔔 Real-time Notifications (Webhook)
*   **Purpose**: Keep stakeholders informed without checking the dashboard.
*   **Features**:
    *   **Multi-Channel**: Built-in support for **DingTalk, WeCom, Feishu, Slack, Telegram, Discord, Bark** and more.
    *   **Smart Triggers**: Alert Supervisors on **Hold/QN**, notify Planners on **Done**, and send **Daily Morning Reports**.
    *   **Dynamic Config**: Customize payloads, headers, and endpoints for any system integration.

### 7. 🔌 External REST API v1
*   **Purpose**: Securely integrate with other factory systems (MES, WMS, BI).
*   **Features**:
    *   **Management UI**: Create and revoke API keys with granular permissions (e.g., `orders:read`, `reports:read`).
    *   **Bearer Auth**: Standardized token-based authentication for secure machine-to-machine access.
    *   **Comprehensive Docs**: Built-in testing guide for rapid integration.

---

## 🛠️ Technology Stack

```mermaid
flowchart TB
    subgraph Client ["Frontend (Next.js 16)"]
        UI[React 19 UI]
        TW[Tailwind CSS v4]
        Icon[Lucide Icons]
        Chart[Recharts]
    end

    subgraph Server ["Backend Services"]
        API[Next.js API Routes]
        Scheduler["Smart Scheduler
        (Weighted / Auto-Flow)"]
        Watcher[Chokidar File Watcher]
        Prisma[Prisma ORM]
    end

    subgraph Data ["Data Persistence"]
        Postgres[(PostgreSQL Database)]
        Redis[(Redis Pub/Sub)]
        Excel["Excel Files (.xlsx)"]
        ApiKeyStore["ApiKey Store (Encrypted)"]
    end

    subgraph AI ["Intelligence"]
        OpenAI["OpenAI / DeepSeek / Ollama"]
    end

    %% Connections
    UI --> API
    API --> Prisma
    API --> Scheduler
    Scheduler --> Prisma
    Prisma --> Postgres
    API --> Redis
    Prisma --> ApiKeyStore
    Watcher -->|Auto-Import| Excel
    Watcher -->|Write| Prisma
    API -->|Context| OpenAI
    OpenAI -->|Analysis| API

    %% Styling
    classDef fe fill:#e0f2fe,stroke:#0284c7,color:#0c4a6e;
    classDef be fill:#dcfce7,stroke:#16a34a,color:#14532d;
    classDef db fill:#f3e8ff,stroke:#9333ea,color:#581c87;
    classDef ai fill:#fee2e2,stroke:#dc2626,color:#7f1d1d;

    class UI,TW,Icon,Chart fe;
    class API,Watcher,Prisma,Scheduler be;
    class SQLite,Excel,Postgres,Redis,ApiKeyStore db;
    class OpenAI ai;
```

---

## 🔒 Security & Management
*   **Role-Based Access**: Strict separation between Admin, Supervisor, User, and Kiosk roles.
*   **Log Management**: Full CSV export capabilities for post-mortem analysis.

---

### Visual Experience

#### 1. The Gateway (Login)
Stunning dark-themed login portal with the new v8.0.0 branding featuring internationalization support.
![Login Screen](public/screenshots/login.png)

#### 2. The Command Center (Dashboard)
Comprehensive production data grid with detailed management controls.
![Dashboard View](public/screenshots/dashboard.png)

#### 3. The Control Tower (Kiosk Mode)
Optimized for large screens, this view aligns data perfectly for shop floor visibility.
![Kiosk Mode](public/screenshots/kiosk.png)

#### 4. The AI Assistant (Production Copilot)
Real-time risk analysis and data insights powered by LLMs.
![AI Chat Interface](public/screenshots/ai-chat.png)

#### 5. The Frontline (Mobile Worker View)
Simplified, touch-friendly interface for operators on the floor.
<img src="public/screenshots/worker-mobile.png" width="300" alt="Worker Mobile View">

---

### DEMO
### DEMO
*   **Live App**: https://protracker.puppy101.dpdns.org/
*   **Showcase & Docs**: https://iprotrax.work
Contact author for access: contact@iprotrax.work

---

## 📝 Changelog highlights
*   **v8.2.0**: **Smart Scheduler 2.0** - "Zero-Wait" Auto-Flow feature, Simplified priority logic (Red Bonus/+1000) and optimized default weights (50/50). **Dashboard** - Enhanced sorting (Red > Yellow > Date). **Operation UI** - Improved target quantity display in header. Batch Edit stability fixes.
*   **v8.1.0**: **Security Upgrade** - Implementing ES256 hardware-backed signing (YubiKey) for licenses. **Free Tier** - Now supports permanent free use for small teams (1 Line, 10 Users). Productivity Engine - "Active Sessions" card, Real-time Efficiency, Quick Stop.
*   **v8.0.0**: Enterprise Edition - Full internationalization (English/Chinese), enhanced security (session encryption), comprehensive testing framework (Vitest/Playwright), performance optimizations, and improved Docker deployment automation.
*   **v7.0.0**: Smart Comments (Order-level Collaboration), Configurable AI Visibility, Enhanced AI Privacy (Strict ID mode), Supervisor Excel Import, and Multi-tier Employee Cooperation.
*   **v6.5.0**: Docker Production Support (Node 22, Fixed Watcher, CVE Remediation).
*   **v6.4.0**: Added Order Deletion & Kiosk Alignment fixes.
*   **v6.3.0**: Introduced Super Edit Mode.
*   **v6.1.0**: Launched Professional Kiosk Mode.

---

## 🛡️ License & Community
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![GitHub Stars](https://img.shields.io/github/stars/Tropical8818/iProTraX?style=social)](https://github.com/Tropical8818/iProTraX)

## 📈 Git Trend
[![Star History Chart](https://api.star-history.com/svg?repos=Tropical8818/iProTraX&type=Date)](https://star-history.com/#Tropical8818/iProTraX&Date)
