import * as fs from 'fs';
import * as path from 'path';

const write = (p: string, content: string) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content.trim() + '\n', 'utf8');
  console.log(`Created: ${p}`);
};

// 1. Providers
write('/providers/database/database-postgres/provider-manifest.yaml', `
apiVersion: codexvantaos.org/v1
kind: ProviderManifest
metadata:
  name: database-postgres
spec:
  capability: database
  provider: postgres
`);
write('/providers/database/database-postgres/config.schema.json', `
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "POSTGRES_URI": { "type": "string" }
  },
  "required": ["POSTGRES_URI"]
}
`);
write('/providers/vector-store/vector-store-pgvector/provider-manifest.yaml', `
apiVersion: codexvantaos.org/v1
kind: ProviderManifest
metadata:
  name: vector-store-pgvector
spec:
  capability: vector-store
  provider: pgvector
`);
write('/providers/vector-store/vector-store-pgvector/config.schema.json', `
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "PGVECTOR_COLLECTION": { "type": "string" }
  }
}
`);

// 2. Vector Store & Knowledge Graph
write('/vector-store/collections/mycodexvantaos-ai-memory--memories--bge-small-384.yaml', `
id: mycodexvantaos-ai-memory--memories--bge-small-384
service: mycodexvantaos-ai-memory
purpose: memories
embeddingModel: bge-small-384
`);
write('/vector-store/embedding-model-aliases/openai--text-embedding-3-small--1536d.yaml', `
alias: openai--text-embedding-3-small--1536d
provider: openai
model: text-embedding-3-small
dimensions: 1536
`);
write('/vector-store/retrieval-pipelines/retrieval--dense--pgvector.yaml', `
id: retrieval--dense--pgvector
strategy: dense
store: pgvector
`);

write('/knowledge-graph/namespaces/ns-core.ttl', `
@prefix core: <https://mycodexvantaos.org/ns/core#> .
core:System a core:Entity .
`);
write('/knowledge-graph/relations/relation-types.ttl', `
@prefix rel: <https://mycodexvantaos.org/ns/relations#> .
rel:DEPENDS_ON a rel:RelationshipType .
rel:PROVIDES_CAPABILITY a rel:RelationshipType .
`);
write('/knowledge-graph/indexes/graph-idx--mycodexvantaos-governance--policy--name.yaml', `
id: graph-idx--mycodexvantaos-governance--policy--name
service: mycodexvantaos-governance
label: policy
property: name
type: exact
`);

// 3. Services Scaffold
const services = [
  'mycodexvantaos-core-auth',
  'mycodexvantaos-ai-embedding',
  'mycodexvantaos-data-vector-store',
  'mycodexvantaos-platform-notification'
];

for (const sId of services) {
  const shortId = sId.replace('mycodexvantaos-', '');
  const domain = shortId.split('-')[0];

  write(\`/services/\${sId}/package.json\`, \`
{
  "name": "@mycodexvantaos/\${shortId}",
  "version": "1.0.0",
  "main": "src/index.ts",
  "scripts": { "build": "tsc" }
}
  \`);
  write(\`/services/\${sId}/src/index.ts\`, \`
export function start() { console.log('\${sId} started'); }
  \`);
  write(\`/modules/\${sId}/module-manifest.yaml\`, \`
apiVersion: codexvantaos.org/v1
kind: ModuleManifest
metadata:
  name: \${sId}
spec:
  domain: \${domain}
  \`);
  write(\`/infra/kubernetes/base/\${sId}/deployment.yaml\`, \`
apiVersion: apps/v1
kind: Deployment
metadata:
  name: \${sId}
  \`);
  write(\`/packages/\${shortId}/package.json\`, \`
{
  "name": "@mycodexvantaos/\${shortId}",
  "version": "1.0.0",
  "main": "src/index.ts"
}
  \`);
  write(\`/packages/\${shortId}/src/index.ts\`, \`
export const name = "@mycodexvantaos/\${shortId}";
  \`);
}
