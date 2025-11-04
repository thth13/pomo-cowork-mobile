# Pomo Cowork Mobile

A lightweight coworking Pomodoro app built with React Native and Expo.

## Features

- ⏱️ **Pomodoro Timer** - Full work, short break, and long break cycles
- ✅ **Task Management** - Create, edit, and track focus tasks
- 👥 **Active Sessions** - See teammates working in real time
- 💬 **Chat** - Message coworkers through Socket.IO channels
- 📊 **Productivity Stats** - Monitor progress across sessions
- 🔔 **Notifications** - Get push alerts when sessions end
- 🌙 **Dark Theme** - Switch between light and dark modes
- 🔄 **Sync** - Keep data aligned with the backend API

## Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI
- A reachable backend server (set the host/IP in your env file)

## Quick Start

```bash
npm install
cp .env.example .env
# update EXPO_PUBLIC_API_URL and EXPO_PUBLIC_SOCKET_URL
npm start
```

Use `npm run ios` or `npm run android` after the dev server is up. The app reads the `EXPO_PUBLIC_*` variables via `config/constants.ts`, so use your machine IP instead of `localhost` when testing on a device.

## Directory Guide

- `App.tsx` – application entry point and navigation
- `screens/` – main UI screens (timer, stats, profile, settings)
- `components/` – shared UI blocks such as `PomodoroTimer`, `TaskList`, `ActiveSessions`, `Chat`
- `stores/` – Zustand stores for auth and timer state
- `hooks/` – utilities like `useSocket` for Socket.IO
- `types/` – shared TypeScript types

## API & Realtime

REST endpoints under `/api` cover auth, sessions, tasks, and chat history. Socket.IO events keep sessions and chat in sync (`session:start`, `session:tick`, `chat:message`, etc.).

## License

MIT
