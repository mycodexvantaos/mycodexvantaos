# auth-service Architecture

## Overview

Provides login and token verification endpoints.

## Directory Structure

    src/
      index.ts
      server.ts
      middleware/
        authMiddleware.ts
      services/
        AuthService.ts
        TokenService.ts
        RbacService.ts
      types/
        auth.types.ts
    tests/
      AuthService.test.ts
      TokenService.test.ts
      RbacService.test.ts
      server.test.ts
