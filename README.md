# myGroww — Personal Finance Command Center

myGroww is a high-performance, private, and visually stunning personal finance dashboard built for power users who want a **Single Source of Truth** for their wealth. 

![myGroww Dashboard Overview](https://raw.githubusercontent.com/priyanshup1/myGroww/master/public/screenshot-preview.png) *(Placeholder: Update with actual screenshot if available)*

## 🚀 Key Features

- **💰 360° Financial Snapshot**: Track your Net Worth, Total Investments, and Emergency Fund in one place.
- **📈 Advanced SIP Tracker**: Manage all your mutual fund SIPs and lumpsum investments with automated total calculations.
- **👪 Family Contribution**: Dedicated tracking for monthly support shared with family vs. personal retained income.
- **⚡ The Money Flow Engine**: Interactive visualization of how your salary moves from Income → Expenses → Wealth Building.
- **🧾 Smart Expense Tracker**: categorized monthly spending with automated ratio analysis.
- **🧠 Intelligent Insights**: AI-style financial health checks on diversification, emergency fund safety, and savings discipline.
- **🔒 100% Private**: Your data never leaves your browser. All storage is local and secure.

## 📊 Core Metrics (The 8 Pillars)

myGroww tracks your financial health through 8 specific, derived metrics:
1. **Family Contribution**: Shared vs. Gross Income ratio.
2. **Amount Retained**: Actual cash available for your own life.
3. **Expense Ratio**: Spending relative to retained income.
4. **SIP Ratio**: Investment discipline relative to what you keep.
5. **Money Left**: Surplus/Deficit after all outgoings.
6. **Emergency Gap**: Precise target to reach 6 months of safety.
7. **Active Funds**: Monitoring your portfolio breadth.
8. **Wealth Building**: Overall investment velocity.

## 🛠️ Tech Stack

- **Framework**: React 18 + Vite (Ultra fast HMR)
- **Styling**: Vanilla CSS (High-performance custom design system)
- **State Management**: Custom React Hooks + Local Storage Persistence
- **Visualization**: Recharts (Pie & Flow charts)
- **Icons**: Emoji Glyphs + Custom SVG

## 📦 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/priyanshup1/myGroww.git
cd myGroww
```

### 2. Install dependencies
```bash
npm install
```

### 3. Run development server
```bash
npm run dev
```

## 📜 Usage & Architecture

The application follows a **Single Source of Truth** architecture. All financial logic is centralized in the `useFinanceData` hook. 
- Use the **Dashboard** for a high-level command view.
- Use **Financial Snapshot** to edit your core income and safety net.
- Use **SIP Tracker** to manage long-term wealth assets.

---
Built with ❤️ for financial freedom.
