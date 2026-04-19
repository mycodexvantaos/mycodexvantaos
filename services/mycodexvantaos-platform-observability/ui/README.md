# mycodexvantaos-platform-observability UI Architecture

## Overview
Provides monitoring, metrics visualization, and system insight dashboards for the MyCodexVantaOS ecosystem.

## Directory Structure
```text
services/mycodexvantaos-platform-observability/ui/
  ├── package.json
  ├── src/
  │   ├── index.ts
  │   ├── main.tsx
  │   ├── App.tsx
  │   ├── components/
  │   │   └── Layout.tsx
  │   ├── hooks/
  │   │   └── useObservabilityData.ts
  │   ├── pages/
  │   │   ├── Dashboard.tsx
  │   │   └── MetricsView.tsx
  │   ├── services/
  │   │   └── api.ts
  │   ├── assets/
  │   │   └── styles/
  │   │       └── global.css
  │   └── vite-env.d.ts
  ├── tests/
  │   ├── App.test.tsx
  │   └── setup.ts
  └── index.html
```
