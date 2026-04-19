#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <service-id>"
  exit 1
fi

SERVICE_ID=$1
if [[ ! "$SERVICE_ID" =~ ^mycodexvantaos-(core|ai|data|platform|security|docs|governance)-[a-z0-9-]+$ ]]; then
  echo "Error: Invalid SERVICE_ID. Must match naming spec: ^mycodexvantaos-(core|ai|data|platform|security|docs|governance)-[a-z0-9-]+$"
  exit 1
fi

SHORT_ID=${SERVICE_ID#mycodexvantaos-}
DOMAIN=$(echo $SHORT_ID | cut -d'-' -f1)

echo "Generating scaffold for $SERVICE_ID ..."

# 1. Services
mkdir -p "services/$SERVICE_ID/src"
mkdir -p "services/$SERVICE_ID/tests"
cat <<EOF > "services/$SERVICE_ID/package.json"
{
  "name": "@mycodexvantaos/$SHORT_ID",
  "version": "1.0.0",
  "main": "src/index.ts",
  "scripts": {
    "build": "tsc"
  }
}
EOF
cat <<EOF > "services/$SERVICE_ID/src/index.ts"
export function start() {
  console.log('$SERVICE_ID started');
}
EOF
cat <<EOF > "services/$SERVICE_ID/Dockerfile"
FROM node:20-alpine
WORKDIR /app
COPY . .
ENTRYPOINT ["node", "src/index.js"]
EOF
echo "MYCODEXVANTAOS_NODE_ENV=development" > "services/$SERVICE_ID/.env.example"

# 2. Modules
mkdir -p "modules/$SERVICE_ID"
cat <<EOF > "modules/$SERVICE_ID/module-manifest.yaml"
apiVersion: codexvantaos.org/v1
kind: ModuleManifest
metadata:
  name: $SERVICE_ID
spec:
  domain: $DOMAIN
EOF
echo "capabilities: []" > "modules/$SERVICE_ID/capabilities.yaml"

# 3. Infra base
mkdir -p "infra/kubernetes/base/$SERVICE_ID"
cat <<EOF > "infra/kubernetes/base/$SERVICE_ID/deployment.yaml"
apiVersion: apps/v1
kind: Deployment
metadata:
  name: $SERVICE_ID
spec:
  selector:
    matchLabels:
      app: $SERVICE_ID
  template:
    metadata:
      labels:
        app: $SERVICE_ID
    spec:
      containers:
      - name: $SERVICE_ID
        image: registry.internal/mycodexvantaos/$SERVICE_ID:latest
EOF
cat <<EOF > "infra/kubernetes/base/$SERVICE_ID/service.yaml"
apiVersion: v1
kind: Service
metadata:
  name: $SERVICE_ID
spec:
  selector:
    app: $SERVICE_ID
  ports:
    - protocol: TCP
      port: 80
      targetPort: 8080
EOF

# 4. Package reference (Optional according to spec)
mkdir -p "packages/$SHORT_ID/src"
cat <<EOF > "packages/$SHORT_ID/package.json"
{
  "name": "@mycodexvantaos/$SHORT_ID",
  "version": "1.0.0",
  "main": "src/index.ts"
}
EOF

echo "Scaffold generated."
