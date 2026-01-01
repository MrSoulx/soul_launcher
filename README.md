# soul-launcher-v2 🎮
Launcher created for fun to use with my friends.

## 🚀 Main Features
- **Official Microsoft Auth**: Secure login via Microsoft/Xbox accounts.
- **Admin Panel**: Manage modpacks, versions, and users dynamically (integrated with Supabase).
- **Auto-Java Management**: Automatically downloads and configures Java 8, 17, or 21 depending on the Minecraft version.
- **Modpack License System**: Support for private/protected modpacks using license keys.
- **Real-time Diagnostics**: Built-in system to generate and view stability reports.

## 🛠️ Technology Stack
- **Frontend**: React + Vite + Vanilla CSS.
- **Backend (Desktop)**: Electron.
- **Database**: Supabase (PostgreSQL + Real-time).
- **Minecraft Core**: MCLC (Minecraft Launcher Core).

## ⚙️ Configuration
This project requires a Supabase instance to function. 

1. **Environment Variables**: Copy `.env.example` to `.env`.
2. **Supabase Setup**:
   - Provide your `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY`.
   - Ensure your database has the expected tables (`modpacks`, `modpack_versions`, `users`, `license_keys`).

## 💻 Development & Build
```bash
# Install dependencies
npm install

# Run in development
npm run dev

# Build Windows installer
npm run build:full
node build-installer.js
```

---
Developed by **MrSoulx, Walter Gomez N.**.
Built with ❤️ for the community.
