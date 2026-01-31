# iProTraX User Manual

**Version 8.2.0**

---

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
   - [System Requirements](#system-requirements)
   - [Login](#login)
   - [Registration](#registration)
3. [Dashboard Overview](#dashboard-overview)
   - [Navigation](#navigation)
   - [Product Line Selection](#product-line-selection)
   - [Order Table](#order-table)
4. [Operation View](#operation-view)
   - [Barcode Scanning](#barcode-scanning)
   - [Quick Status Updates](#quick-status-updates)
   - [Smart Comments](#smart-comments)
   - [Step Progress Tracking](#step-progress-tracking)
5. [Batch Operations](#batch-operations)
   - [P Mode](#p-mode)
   - [N/A Mode](#na-mode)
   - [Hold Mode](#hold-mode)
   - [QN Mode](#qn-mode)
   - [WIP Mode](#wip-mode)
   - [Complete Mode](#complete-mode)
   - [Erase Mode](#erase-mode)
   - [Super Edit Mode](#super-edit-mode)
6. [Importing Orders](#importing-orders)
7. [AI Assistant](#ai-assistant)
8. [Settings](#settings)
   - [Product Line Configuration](#product-line-configuration)
   - [AI Settings](#ai-settings)
   - [User Management](#user-management)
   - [Data Management](#data-management)
9. [Unified Analytics](#unified-analytics)
10. [User Roles & Permissions](#user-roles--permissions)
10. [User Roles & Permissions](#user-roles--permissions)
11. [License & Free Tier](#license--free-tier)
12. [Troubleshooting](#troubleshooting)

---

## Introduction

**iProTraX** is an AI-powered production tracking system designed for manufacturing environments. It helps you:

- Track work orders through multiple production steps
- Update order status in real-time via desktop or mobile
- Analyze production data with an AI assistant
- Manage multiple product lines from a single interface

---

## Getting Started

### System Requirements

- Modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection or access to the local server
- For mobile: iOS Safari or Android Chrome

### Login

1. Navigate to the iProTraX URL (e.g., `http://localhost:3001`)
2. Enter your **Employee ID** and **Password**
3. Click **Login**

> **Note**: If you don't have an account, contact your administrator or use the registration link.

### Registration

1. Click "Don't have an account? Create one"
2. Enter your desired username, **Employee ID**, and password
3. Submit the form
4. Wait for administrator approval (new accounts require approval)

---

## Dashboard Overview

After logging in, you'll see the main dashboard with all your orders.

### Navigation

| Button | Description |
|--------|-------------|
| **Home** | Main dashboard with order table |
| **Operation** | Simplified view for production floor workers |
| **Settings** | Configure products, users, and system settings |

### Product Line Selection

- Click the **product dropdown** in the header to switch between product lines
- Each product line has its own orders, steps, and configuration
- **Column Resizing**: Drag the edges of column headers to adjust width. Settings are saved automatically.

### Order Table

The main table shows all work orders with:

- **Detail Columns**: Order ID, customer, due date, quantity, etc. (Default sorting: High Priority > Warning > Earliest Due Date)
- **Step Columns**: Production steps (e.g., Cutting, Assembly, QC)
- **Status Indicators**:
  - 📘 **P** = Planned/Pending
  - ⬜ **N/A** = Not Applicable (Considred 'Completed' if in the final step)
  - 🟠 **Hold** = On Hold
  - 🔴 **QN** = Quality Notification (issue)
  - 🟡 **WIP** = Work In Progress
  - ✅ **Date** = Completed (shows completion date)

---

---

## Operation View

The **Operation View** is optimized for production floor workers using tablets or mobile devices.

### Barcode Scanning

1. Click the **Scan** button (barcode icon)
2. Point camera at the WO ID barcode
3. The system will automatically locate and display that order

### Quick Status Updates

In Operation View, you can quickly update order status:

1. Find your order (by scanning or scrolling)
2. Tap on a step cell
3. Select the new status from the popup menu:
   - **Complete** - Mark as done with timestamp
   - **WIP** - Work in progress
   - **Hold** - Put on hold
   - **QN** - Quality notification
   - **N/A** - Not applicable

### Smart Comments

Collaborate directly on specific steps to solve issues faster.

1.  **Click the Comment Icon** attached to any step in Operation View.
2.  **Add a Comment**: Type your message.
3.  **Select a Category**: Tag the comment to help the AI analyze issues.
    *   `General`: Normal discussion.
    *   `QN` (Quality): Quality issues, defects.
    *   `Material`: Missing parts, wrong material.
    *   `Machine`: Equipment breakdown or maintenance.
    *   `Hold`: Process blockers.
4.  **Send**: The comment is logged with your User ID and timestamp.

### Step Progress Tracking

*(New in v8.1.0)*

Track time-on-task for each production step to calculate worker efficiency and monitor progress in real-time.

#### 1. My Active Sessions
A new card appears at the top of the Operation View showing your currently active tasks:

*   **Live Timer**: Shows elapsed time (HH:MM:SS).
*   **Standard Time (Std)**: Yellow badge showing the target time for this step (e.g., `Std: 1h 30m`).
*   **Progress Bar**: Visualizes completion percentage against target quantity.
    *   **Completed**: Quantity of good parts you have submitted.
    *   **Left**: Target quantity minus completed quantity.
    *   *Note: Progress bar is hidden if no Target Quantity is configured in settings.*
*   **Quick Stop**: Red button on the card allows you to finish work without opening the detail view.

#### 2. Starting & Stopping
1.  **Start**: Find the step in Operation View and click **Track Progress**.
2.  **Stop**:
    *   Method 1: Click the **Stop** button on the "My Active Sessions" card.
    *   Method 2: Click the track button again to open details, then click **Stop Step**.
3.  **Input Quantity**:
    *   Enter quantity produced.
    *   **Strict Validation**: Input cannot exceed the remaining target quantity.

#### 3. Efficiency & Reports (Supervisor/Admin Only)
*   **Efficiency**: Calculated as `Standard Time / Actual Time`. >100% means faster than target.
*   **View Reports**: Click the **Reports** icon 📊 in the header.
    *   *Note: Regular users cannot see the reports feature.*
    *   View daily output, worker efficiency rankings, and step duration distribution.

---

## Kiosk Mode (Shop Floor Monitor)

**Kiosk Mode** is designed for terminal displays (tablets or large screens) situated on the production floor, providing a high-contrast, full-screen view.

### Accessing Kiosk Mode
- **Dedicated Account**: It is recommended to create a user with the `kiosk` role. Once logged in, this account is automatically locked to the Shop Floor Monitor and cannot access the administrative dashboard.
- **Long-Term Session**: Kiosk sessions stay active for **30 days**, making them ideal for always-on display terminals.

### Key Features
- **Auto-Refresh**: Production data updates automatically every 60 seconds.
- **Smooth Auto-Scroll**: If there are many orders, the display will smoothly scroll to loop through all active work orders.
- **Console Lock**:
    - Click the factory logo in the header to attempt administrative actions.
    - **Secure Unlock**: You must enter the currently logged-in account's **Password** to unlock the console for switching product lines or filtering stages.
    - **Display Density**: Toggle between **Comfortable** (default) and **Compact** views using the list icon in the header to fit more orders on the screen.
    - Once unlocked, the console remains active until you click the lock icon again.

---

---

## Batch Operations

For supervisors and admins, batch operations allow updating multiple cells quickly.

### P Mode

- Click **P** button to enter P Mode
- Click any step cell to toggle "P" (Planned) status
- Click **P** again to exit

### N/A Mode

- Mark steps as "Not Applicable" for orders that skip certain steps

### Hold Mode

- Put orders on hold when waiting for materials or approvals

### QN Mode

- Mark steps with quality issues requiring attention

### WIP Mode

- Indicate work is actively in progress

### Complete Mode

- Click to mark steps as complete with current date/time stamp

### Erase Mode

- **Admin only** or requires password for supervisors
- Clears any status from a cell
- Use with caution!

### Super Edit Mode

*(New in V6.3.0 - Admin/Supervisor Only)*

- **Function**: Directly modify order detail columns (WO ID, PN, Description, etc.) without re-importing Excel.
- **How to use**:
    1. Click the **Lock Icon** 🔒 in the top-left WO ID cell.
    2. The icon unlocks 🔓 and table borders change color to indicate edit mode.
    3. Click any detail cell (WO ID, PN, Priority, Due Date) to edit.
    4. Type new value and press Enter. Changes are saved immediately.
- **Restriction**: **ECD** column is auto-calculated and cannot be edited.
- **Note**: Changes are instant. Please use with caution.

---

## Log Management

### Operation Logs
The system tracks every change made to orders. You can view these logs by clicking the **History** icon in the dashboard header.

### Export & Clear (Admin/Supervisor)
In the Operation Logs modal:
1.  **Download CSV**: Click the green **CSV** button to download full logs for Excel analysis.
2.  **Clear Logs**: (Admin Only) Click the red **Clear** button to permanently delete all history. This is useful when starting a new production cycle.

---

## Importing Orders

### Excel Import (Admin/Supervisor)

1. Click the **Import** button in the header
2. Select your Excel file (.xlsx or .xls)
3. Review the import preview
4. Click **Import** to add new orders

> **Note**: Existing WO IDs are automatically skipped to prevent duplicates.



---

## AI Assistant

iProTraX includes a smart, floating AI assistant to help you:

- Analyze production risks and delays
- Generate daily morning reports
- Navigate automatically to specific orders
- Answer questions about production status

### Using the AI

1. Click the **Chat Icon** 💬 (bottom right of screen)
2. Type your question or use the **Quick Tools** (Admin/Supervisor only):
    - **Analyze Risks**: Identify orders at risk of delay.
    - **Morning Report**: Generate a summary for your daily standup.
    - **Category Diagnosis**: Ask "What are the top quality issues?" to analyze comments tagged with `QN`.

### AI Category Analysis 🧠
The AI automatically aggregates comments by category to provide deep insights:
*   **Bottleneck Detection**: "Why are 5 orders on Hold in Assembly?" (Analyzes `Hold` comments)
*   **Maintenance Alerts**: "Show me recent machine issues." (Analyzes `Machine` comments)
*   **Quality Trends**: "Summarize QN reports from last week." (Analyzes `QN` comments)

### Smart Navigation 🚀
You can ask the AI to take you to an order:
*   "Show me WO-1234"
*   "Go to order 5555"

**Result**: The system will automatically jump to the **Operation View** for that order.

### Example Questions

- "Which orders are behind schedule?"
- "What's the average time in Winding step?"
- "Show me orders with QN status"
- "Summarize today's production"

---

## Settings

Access Settings from the navigation bar.

### Product Line Configuration
*(Admin only)*
Configure detailed parameters for each production line to enable advanced tracking features.

1.  **Add/Edit Product Line**: Operate in the "Product Line Configuration" area of the Settings page.
2.  **Step Configuration**:
    *   **Step Name**: Define each step in the production process (e.g., Winding, Assembly).
    *   **Standard Time (Hours)**: Set the standard time for this step (Hours/Minutes) to calculate worker efficiency.
    *   **Target Qty**: Set the target output quantity for this step. *Setting this will enable the progress bar in Operation View.*
    *   **Unit**: The unit of measurement for output (e.g., pcs, sets, kg).
3.  **Other Settings**:
    *   **Monthly Target**: Set the total output target for dashboard statistics.
    *   **Auto Import**: Configure folder path for automatic Excel order import.
    *   **Detail Columns**: Configure order info fields.
    *   **ECD Settings**: Configure delivery estimate logic.

### AI Settings

*(Admin only)*

Configure the AI assistant for your environment.

1.  **AI Model Selection**:
    *   **DeepSeek (China)**: Optimized for domestic users, fast speed, strong Chinese understanding.
    *   **OpenAI**: GPT-4o / GPT-3.5, requires global internet access.
    *   **Local (Ollama)**: For private, on-premise deployment.
2.  **Configure DeepSeek**:
    *   Select "DeepSeek (China)".
    *   Enter your API Key (get from deepseek.com).
    *   Click **Test Connection**.
3.  **Custom Instructions**:
    *   Add product-specific terminology, common defect codes, or operational specs in the "Product Knowledge Base".
    *   The AI will use this info to provide more professional answers.

### User Management

*(Admin/Supervisor)*

Navigate to **Settings → User Management** to:

- View all users
- Approve pending registrations
- Reset passwords
- Enable/disable accounts
- Delete users (admin only)

### Data Management

*(Admin only)*

- **Export CSV**: Download all production data
- **Cleanup**: Remove data older than 3 months

---

## Notifications & Webhooks

*(New in v8.1.0)*

iProTraX can send real-time alerts to your external collaboration tools (Slack, Teams, DingTalk, Telegram, etc.) when critical events occur on the production floor.

### Configuration

Navigate to **Settings → Notifications**:

1.  **Add Webhook**: Click the "Add Webhook" button.
2.  **Select Provider**: Choose from 13+ built-in providers or use Custom.
    *   **Generic** (DingTalk, WeCom, Slack, Teams, Feishu, Discord): Enter the `Webhook URL`.
    *   **Bark (iOS)**: Enter `Server URL` (e.g., `https://api.day.app`), `Device Key`, `Sound`, and `Icon`.
    *   **Telegram**: Enter `Bot Token` and `Chat ID`.
    *   **Gotify**: Enter `Server URL` and `App Token`.
    *   **Custom**: Configure `Webhook URL`, `HTTP Method` (POST/GET), `Headers` (JSON), and `Body Template` (JSON).
3.  **Select Triggers**:
    *   **On Hold**: Critical alert when an order is put on hold.
    *   **QN Issue**: Critical alert for quality issues.
    *   **Order Completed**: Notification when an order finishes the last step.
    *   **Step Update**: Real-time progress updates (optional).
    *   **Daily Morning Report**: Automated daily summary at 8:00 AM.
    *   **New Message**: Notification when you receive a message or are @mentioned in the system.

### Custom Webhook Template Variables

If using the **Custom** provider, you can use these placeholders in your Body Template:
*   `{{orderId}}`: Order ID (e.g., WO-1234)
*   `{{status}}`: Current status (e.g., Hold, QN)
*   `{{step}}`: Current production step
*   `{{productName}}`: Name of the product line
*   `{{sender}}`: Name of the message sender (for message events)
*   `{{message}}`: Content of the message

---

---

## Unified Analytics

*(New in v8.0.0)*

The **Analytics Dashboard** replaces the old "Production Insights" with a powerful report builder.

### Accessing Analytics
Click the **Insights** icon (Graph) in the dashboard header.

### 1. Overview Tab
Shows standard KPIs:
- **Daily Output**: Production count trends.
- **Productivity**: Operator efficiency ranking.

### 2. Custom Builder Tab
Create your own reports to answer specific questions.

#### How to Build a Report:
1.  **Select Data Source**:
    - `Work Orders` (Live Status): Current snapshot of the floor.
    - `Operation Logs` (History): Historical performance over time.
2.  **Group By**: Choose a dimension (e.g., `Status`, `Operator`, `Step`).
3.  **Metrics**: Currently supports `Count`, `Sum`, and `Average`.
4.  **Time Range**: Filter by Today, Last 7 Days, or All Time.

#### Example Reports:
- **"How many orders are on Hold?"**: Source: `Work Orders`, Group By: `Status`.
- **"Who completed the most steps today?"**: Source: `Operation Logs`, Group By: `Operator`, Time: `Today`.
- **"What are the top defect types?"**: Source: `Operation Logs`, Filter: `Action = QN`, Group By: `Details`.

---

## User Roles & Permissions

| Role | Permissions |
|------|-------------|
| **User** | View orders, update status in Operation View |
| **Kiosk** | Strictly restricted to Shop Floor Monitor, 30-day sessions, no dashboard access |
| **Supervisor** | All User permissions + Import orders, batch operations, manage basic users |
| **Admin** | All permissions + Settings, User Management, Data Management |

---

## License & Free Tier

iProTraX uses a secure license key system.

### License Types

- **Free Tier / Trial**: Automatically activated if no license key is provided or if a license expires.
- **Pro**: Unlocks more product lines and users.
- **Enterprise**: Custom limits for large organizations.

### Free Tier Limits

If you are on the Free Tier:
1.  **Product Lines**: Limited to **1 Product Line**.
2.  **Users**: Limited to **10 Users**.
3.  **Time Limit**: **None**. You can use the Free Tier indefinitely.

> **Note**: If you exceed the user limit, new user registrations will be blocked until you upgrade your license or remove inactive users.

---

## Troubleshooting

### Common Issues

**Q: Page keeps refreshing**
- Clear browser cache and cookies
- Try a different browser
- Contact administrator to restart the server

**Q: Can't log in**
- Check Employee ID and password
- Ensure your account is approved
- Contact administrator

**Q: Orders not showing**
- Select the correct product line
- Check if you have "Show Completed" enabled
- Refresh the page

**Q: AI not responding**
- Verify OpenAI API key is configured in Settings
- Check your API key balance/quota

---

## Support

For technical support, contact your system administrator.

**iProTraX v8.2.0** - AI-Powered Production Tracker
