# cli Architecture

## Overview

Provides commands for init, config, deploy, scan, and status.

## Directory Structure

    src/
      index.ts
      cli.ts
      bin/
        codexvanta.ts
      commands/
        config.ts
        deploy.ts
        init.ts
        scan.ts
        status.ts
      utils/
        api-client.ts
        config.ts
        logger.ts
    tests/
      cli.test.ts
      config.test.ts
