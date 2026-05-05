# 🕵️ Instagram Tracker

A utility for analyzing Instagram follow data. Shows who doesn’t follow you back, who your fans are, and who is mutual.

## 🚀 Modes

### Mode 1 — TURBO (via browser)
Opens Chrome, you manually log into Instagram, and the program collects data in real time.

**Pros:** accurate data, deleted accounts won’t appear as “rats”  
**Cons:** requires Chrome, manual login, slower  

### Mode 2 — ARCHIVE (via Instagram .zip)
Reads your data archive that you request from Instagram settings.

**Pros:** fast, no browser required, fully offline  
**Cons:** archive must be requested in advance (wait 1–2 days), deleted accounts may appear as “rats”  

## 📦 How to get your Instagram archive

1. Instagram → Settings → Search  
2. Type "Download your information" or "Export your information" → "Select information" and uncheck everything except "Followers and Following"  
3. Set date range to "Last year" → choose **JSON** format → request the file  
4. Within 10 minutes to 1–2 days, Instagram will send a link to your email  
5. Download the `.zip` and place it next to the program  

## 🛠️ Run from source

```bash
git clone https://github.com/kikioju/Instagram_tracker.git
cd Instagram_tracker
npm install
node main.js
```

## 🔨 Build .exe

```bash
npm install
npm run build
```

The ready instagram_tracker.exe does not require Node.js.

## 📁 Results

After analysis, the following files will appear next to the program:

- archive_report.csv — table (opens in Excel)
- archive_report.txt — text report

| Category  | Description                                 |
|-----------|---------------------------------------------|
| 🔴 Rat    | You follow them, they don’t follow you back |
| 🔵 Fan    | They follow you, you don’t follow them      |
| 🟢 Mutual | You follow each other                       |

## ⚠️ Disclaimer

The program uses only your own data and does not violate Instagram rules.

This tool only works with user-owned data (Instagram export) and does not bypass platform protections or access private information.

Do not overuse TURBO mode — frequent automated requests may lead to a temporary account restriction.
