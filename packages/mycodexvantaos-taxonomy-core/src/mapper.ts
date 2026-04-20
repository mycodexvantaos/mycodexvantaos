/**
 * MyCodexVantaOS Taxonomy Mapper
 * 
 * Maps between different naming formats following naming-spec-v1
 */

import { 
  TaxonomyPath, 
  EntityReference, 
  ServiceId, 
  PackageShortId, 
  ModuleId 
} from './types';

/**
 * MyCodexVantaOS Taxonomy Mapper
 * 
 * Provides bidirectional mapping between naming formats
 */
export class MyCodexVantaOSMapper {
  private static readonly ORGANIZATION = 'mycodexvantaos';
  private static readonly SERVICE_PREFIX = 'mycodexvantaos-';
  private static readonly PACKAGE_SCOPE = `@${this.ORGANIZATION}/`;

  /**
   * Extract package short ID from service ID
   * §5.2: package short id = service id without mycodexvantaos- prefix
   */
  static serviceIdToPackageShortId(serviceId: ServiceId): PackageShortId {
    if (!serviceId.startsWith(this.SERVICE_PREFIX)) {
      throw new Error(`Service ID must start with "${this.SERVICE_PREFIX}": ${serviceId}`);
    }
    return serviceId.slice(this.SERVICE_PREFIX.length);
  }

  /**
   * Convert package short ID to service ID
   * §5.2: service id = package short id with mycodexvantaos- prefix
   */
  static packageShortIdToServiceId(packageShortId: PackageShortId): ServiceId {
    return `${this.SERVICE_PREFIX}${packageShortId}`;
  }

  /**
   * Convert service ID to package name
   * §7.1: @mycodexvantaos/<package-short-id>
   */
  static serviceIdToPackageName(serviceId: ServiceId): string {
    const packageShortId = this.serviceIdToPackageShortId(serviceId);
    return `${this.PACKAGE_SCOPE}${packageShortId}`;
  }

  /**
   * Convert package name to service ID
   */
  static packageNameToServiceId(packageName: string): ServiceId {
    if (!packageName.startsWith(this.PACKAGE_SCOPE)) {
      throw new Error(`Package name must start with "${this.PACKAGE_SCOPE}": ${packageName}`);
    }
    const packageShortId = packageName.slice(this.PACKAGE_SCOPE.length);
    return `${this.SERVICE_PREFIX}${packageShortId}`;
  }

  /**
   * Extract domain from service ID
   */
  static extractDomain(serviceId: ServiceId): string {
    const parts = serviceId.split('-');
    // Remove 'mycodexvantaos' prefix
    parts.shift(); 
    // Domain is the first segment after prefix
    return parts[0];
  }

  /**
   * Extract capability from service ID
   */
  static extractCapability(serviceId: ServiceId): string {
    const parts = serviceId.split('-');
    // Remove 'mycodexvantaos' prefix
    parts.shift();
    // Remove domain
    parts.shift();
    // Capability is the remainder joined with hyphens
    return parts.join('-');
  }

  /**
   * Map entity reference to taxonomy path
   */
  static mapToTaxonomyPath(entity: EntityReference): TaxonomyPath {
    const domain = entity.domain;
    const capabilityOrName = entity.capabilityOrName;
    
    // Build canonical identifier
    let canonical: string;
    switch (entity.type) {
      case 'service':
      case 'module':
        canonical = `${this.SERVICE_PREFIX}${domain}-${capabilityOrName}`;
        break;
      case 'package':
        canonical = `${domain}-${capabilityOrName}`;
        break;
      case 'provider':
        // Provider format: <capability>-<provider-name>
        canonical = `${capabilityOrName}-${domain}`;
        break;
      default:
        throw new Error(`Unknown entity type: ${entity.type}`);
    }

    // Add modifier if present
    if (entity.modifier) {
      canonical = `${canonical}-${entity.modifier}`;
    }

    return {
      organization: this.ORGANIZATION,
      domain,
      capability: capabilityOrName,
      canonical,
      package: entity.type === 'service' || entity.type === 'module' 
        ? `${this.PACKAGE_SCOPE}${domain}-${capabilityOrName}`
        : 'mycodexvantaos', // Providers live under main package scope
      k8sResource: entity.type === 'service' || entity.type === 'module'
        ? canonical
        : `${domain}-${capabilityOrName}`
    };
  }

  /**
   * Parse service ID into components
   */
  static parseServiceId(serviceId: ServiceId): {
    organization: string;
    domain: string;
    capability: string;
    packageShortId: PackageShortId;
    packageName: string;
    k8sResourceName: string;
  } {
    const packageShortId = this.serviceIdToPackageShortId(serviceId);
    const [domain, ...capabilityParts] = packageShortId.split('-');
    const capability = capabilityParts.join('-');

    return {
      organization: this.ORGANIZATION,
      domain,
      capability,
      packageShortId,
      packageName: this.serviceIdToPackageName(serviceId),
      k8sResourceName: serviceId
    };
  }

  /**
   * Generate environment variable name
   * §7.2: MYCODEXVANTAOS_<SUBSYSTEM>_<KEY>
   */
  static toEnvVar(serviceId: ServiceId, key: string): string {
    const parts = serviceId.split('-');
    const subsystem = parts.map(part => part.toUpperCase()).join('_');
    const upperKey = key.toUpperCase();
    return `MYCODEXVANTAOS_${subsystem}_${upperKey}`;
  }

  /**
   * Generate OCI image reference
   * §7.3: <registry>/mycodexvantaos/<service-id>:<tag>
   */
  static toOciImageReference(registry: string, serviceId: ServiceId, tag: string = 'latest'): string {
    return `${registry}/${this.ORGANIZATION}/${serviceId}:${tag}`;
  }

  /**
   * Generate internal URI
   * §7.4: mycodexvantaos://<namespace>/<resource-type>/<resource-id>
   */
  static toInternalUri(namespace: string, resourceType: string, resourceIdentifier: string): string {
    return `mycodexvantaos://${namespace}/${resourceType}/${resourceIdentifier}`;
  }

  /**
   * Generate URN
   * §7.5: urn:mycodexvantaos:<type>:<subtype>:<identifier>
   */
  static toUrn(type: string, subtype: string, identifier: string): string {
    return `urn:mycodexvantaos:${type}:${subtype}:${identifier}`;
  }

  /**
   * Generate composite identifier
   * §9: composite separator `--`
   */
  static toCompositeId(...segments: string[]): string {
    return segments.join('--');
  }

  /**
   * Parse composite identifier
   */
  static parseCompositeId(compositeId: string): string[] {
    return compositeId.split('--');
  }

  /**
   * Generate vector collection ID
   * §9.2: <service-id>--<purpose>--<embedding-model-alias>
   */
  static toVectorCollectionId(serviceId: ServiceId, purpose: string, embeddingModelAlias: string): string {
    return this.toCompositeId(serviceId, purpose, embeddingModelAlias);
  }

  /**
   * Generate embedding model alias
   * §9.3: <provider>--<model-name>--<dimension>d
   */
  static toEmbeddingModelAlias(provider: string, modelName: string, dimension: number): string {
    return `${provider}--${modelName}--${dimension}d`;
  }

  /**
   * Generate retrieval pipeline ID
   * §9.4: retrieval--<strategy>--<store-type>
   */
  static toRetrievalPipelineId(strategy: string, storeType: string): string {
    return this.toCompositeId('retrieval', strategy, storeType);
  }

  /**
   * Generate search index ID
   * §9.5: idx--<service-id>--<field>--<analyzer>
   */
  static toSearchIndexId(serviceId: ServiceId, field: string, analyzer: string): string {
    return this.toCompositeId('idx', serviceId, field, analyzer);
  }

  /**
   * Generate graph node ID
   * §9.6: <service-id>--<entity-type>--<natural-key-normalized>
   */
  static toGraphNodeId(serviceId: ServiceId, entityType: string, naturalKey: string): string {
    const normalizedKey = naturalKey.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    return this.toCompositeId(serviceId, entityType, normalizedKey);
  }

  /**
   * Generate timestamped ID
   * §9.8: <prefix>--<yyyymmdd>--<random6>
   */
  static toTimestampedId(prefix: string, date?: Date): string {
    const now = date || new Date();
    const yyyymmdd = now.toISOString().slice(0, 10).replace(/-/g, '');
    const random6 = Math.random().toString(36).substring(2, 8);
    return this.toCompositeId(prefix, yyyymmdd, random6);
  }

  /**
   * Generate content-addressed ID
   * §9.9: <prefix>--sha256-<first12>
   */
  static toContentAddressedId(prefix: string, hash: string): string {
    return this.toCompositeId(prefix, `sha256-${hash.substring(0, 12)}`);
  }

  /**
   * Generate UUID-based ID
   * §9.10: <prefix>--<uuid-without-dashes>
   */
  static toUuidBasedId(prefix: string, uuid: string): string {
    const uuidWithoutDashes = uuid.replace(/-/g, '');
    return this.toCompositeId(prefix, uuidWithoutDashes);
  }

  /**
   * Generate knowledge graph namespace IRI
   * §10.1: https://mycodexvantaos.org/ns/<domain>#<term>
   */
  static toGraphNamespaceIri(domain: string, term: string): string {
    return `https://${this.ORGANIZATION}.org/ns/${domain}#${term}`;
  }

  /**
   * Generate graph database index ID
   * §10.3: graph-idx--<service-id>--<label>--<property>
   */
  static toGraphIndexId(serviceId: ServiceId, label: string, property: string): string {
    return this.toCompositeId('graph-idx', serviceId, label, property);
  }
}