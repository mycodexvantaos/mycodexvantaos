# app-portal Architecture

## Overview

Provides aggregated endpoints for frontend clients.

## Directory Structure

    src/
      index.ts
      server.ts
      controllers/
        AdminController.ts
        AuthController.ts
        DashboardController.ts
      middleware/
        authGuard.ts
      routes/
        admin.routes.ts
        auth.routes.ts
        dashboard.routes.ts
      services/
        AggregationService.ts
    tests/
      admin.test.ts
      auth.routes.test.ts
      dashboard.routes.test.ts
      health.test.ts
