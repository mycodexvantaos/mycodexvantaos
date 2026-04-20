/**
 * MyCodexVantaOS Naming Validation Script
 * 
 * Validates all identifiers against naming-spec-v1
 * Usage: npm run validate:naming
 */

import * as fs from 'fs';
import * as path from 'path';

// Import patterns from taxonomy-core
const PATTERNS = {
  serviceId: /^mycodexvantaos-[a-z0-9]+(?:-[a-z0-9]+)+$/,
  packageShortId: /^[a-z0-9]+(?:-[a-z0-9]+)+$/,
  capabilityId: /^(database|storage|auth|queue|state-store|secrets|repo|deploy|validation|security|observability|notification|scheduler|vector-store|embedding|llm|graph|cache|search)$/,
  providerInstance: /^(database|storage|auth|queue|state-store|secrets|repo|deploy|validation|security|observability|notification|scheduler|vector-store|embedding|llm|graph|cache|search)-[a-z0-9-]+$/,
  packageName: /^@mycodexvantaos\/[a-z0-9-]+$/,
  envVar: /^MYCODEXVANTAOS_[A-Z0-9_]+$/,
  noConsecutiveHyphens: /^(?!.*--).*$/,
  lowercase: /^[a-z0-9-]*$/,
};

const CANONICAL_CAPABILITIES = [
  'database', 'storage', 'auth', 'queue', 'state-store', 'secrets', 
  'repo', 'deploy', 'validation', 'security', 'observability', 
  'notification', 'scheduler', 'vector-store', 'embedding', 'llm', 
  'graph', 'cache', 'search'
];

interface ValidationViolation {
  file: string;
  identifier: string;
  type: string;
  rule: string;
  message: string;
  suggestion?: string;
}

interface ValidationResult {
  total: number;
  valid: number;
  invalid: number;
  violations: ValidationViolation[];
}

/**
 * Validate service ID (naming-spec-v1 §5.1)
 */
function validateServiceId(id: string): { valid: boolean; message?: string } {
  if (!PATTERNS.serviceId.test(id)) {
    return { 
      valid: false, 
      message: `Service ID must follow format: mycodexvantaos-<domain>-<capability>` 
    };
  }
  return { valid: true };
}

/**
 * Validate package short ID (naming-spec-v1 §5.2)
 */
function validatePackageShortId(id: string): { valid: boolean; message?: string } {
  if (!PATTERNS.packageShortId.test(id)) {
    return { 
      valid: false, 
      message: `Package short ID must follow format: <domain>-<capability>` 
    };
  }
  return { valid: true };
}

/**
 * Validate provider instance ID (naming-spec-v1 §8.1)
 */
function validateProviderInstanceId(id: string): { valid: boolean; message?: string } {
  if (!PATTERNS.providerInstance.test(id)) {
    return { 
      valid: false, 
      message: `Provider instance must follow format: <capability-id>-<provider-name>` 
    };
  }
  return { valid: true };
}

/**
 * Validate package name (naming-spec-v1 §7.1)
 */
function validatePackageName(name: string): { valid: boolean; message?: string } {
  if (!PATTERNS.packageName.test(name)) {
    return { 
      valid: false, 
      message: `Package name must follow format: @mycodexvantaos/<package-short-id>` 
    };
  }
  return { valid: true };
}

/**
 * Validate environment variable (naming-spec-v1 §7.2)
 */
function validateEnvVar(name: string): { valid: boolean; message?: string } {
  if (!PATTERNS.envVar.test(name)) {
    return { 
      valid: false, 
      message: `Environment variable must follow format: MYCODEXVANTAOS_<SUBSYSTEM>_<KEY>` 
    };
  }
  return { valid: true };
}

/**
 * Scan all service manifests
 */
function scanServices(basePath: string): ValidationResult {
  const result: ValidationResult = { total: 0, valid: 0, invalid: 0, violations: [] };
  const servicesPath = path.join(basePath, 'services');
  
  if (!fs.existsSync(servicesPath)) {
    console.log('  ℹ️  No services directory found');
    return result;
  }
  
  const serviceDirs = fs.readdirSync(servicesPath).filter(f => 
    fs.statSync(path.join(servicesPath, f)).isDirectory()
  );
  
  for (const serviceDir of serviceDirs) {
    // Check directory name follows service ID format
    result.total++;
    const dirValidation = validateServiceId(serviceDir);
    if (!dirValidation.valid) {
      result.invalid++;
      result.violations.push({
        file: `services/${serviceDir}/`,
        identifier: serviceDir,
        type: 'service-id',
        rule: 'service-id-format',
        message: dirValidation.message || 'Invalid service ID format',
        suggestion: 'Rename directory to follow mycodexvantaos-<domain>-<capability>'
      });
    } else {
      result.valid++;
    }
    
    // Check service-manifest.yaml
    const manifestPath = path.join(servicesPath, serviceDir, 'service-manifest.yaml');
    const altManifestPath = path.join(servicesPath, serviceDir, 'service.manifest.yaml');
    const manifestFile = fs.existsSync(manifestPath) ? manifestPath : 
                         fs.existsSync(altManifestPath) ? altManifestPath : null;
    
    if (manifestFile) {
      const content = fs.readFileSync(manifestFile, 'utf-8');
      
      // Check metadata.name
      const nameMatch = content.match(/name:\s*([^\n]+)/);
      if (nameMatch) {
        const name = nameMatch[1].trim();
        result.total++;
        const nameValidation = validateServiceId(name);
        if (!nameValidation.valid) {
          result.invalid++;
          result.violations.push({
            file: manifestFile.replace(basePath + '/', ''),
            identifier: name,
            type: 'service-id',
            rule: 'manifest-name-format',
            message: nameValidation.message || 'Invalid service name in manifest',
            suggestion: 'Update metadata.name to follow mycodexvantaos-<domain>-<capability>'
          });
        } else {
          result.valid++;
        }
      }
      
      // Check capability label
      const capabilityMatch = content.match(/capability:\s*([^\n]+)/);
      if (capabilityMatch) {
        const capability = capabilityMatch[1].trim();
        result.total++;
        if (!CANONICAL_CAPABILITIES.includes(capability)) {
          result.invalid++;
          result.violations.push({
            file: manifestFile.replace(basePath + '/', ''),
            identifier: capability,
            type: 'capability-id',
            rule: 'canonical-capability',
            message: `Capability must be from canonical set: ${CANONICAL_CAPABILITIES.join(', ')}`,
            suggestion: 'Use one of the 19 canonical capabilities'
          });
        } else {
          result.valid++;
        }
      }
    }
    
    // Check package.json
    const pkgPath = path.join(servicesPath, serviceDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        result.total++;
        const pkgValidation = validatePackageName(pkg.name);
        if (!pkgValidation.valid) {
          result.invalid++;
          result.violations.push({
            file: pkgPath.replace(basePath + '/', ''),
            identifier: pkg.name,
            type: 'package-name',
            rule: 'package-name-format',
            message: pkgValidation.message || 'Invalid package name',
            suggestion: 'Use @mycodexvantaos/<package-short-id> format'
          });
        } else {
          result.valid++;
        }
      } catch (e) {
        // Skip invalid JSON
      }
    }
  }
  
  return result;
}

/**
 * Scan all provider manifests
 */
function scanProviders(basePath: string): ValidationResult {
  const result: ValidationResult = { total: 0, valid: 0, invalid: 0, violations: [] };
  const providersPath = path.join(basePath, 'providers');
  
  if (!fs.existsSync(providersPath)) {
    console.log('  ℹ️  No providers directory found');
    return result;
  }
  
  const providerDirs = fs.readdirSync(providersPath).filter(f => 
    fs.statSync(path.join(providersPath, f)).isDirectory()
  );
  
  for (const providerDir of providerDirs) {
    // Check directory name follows provider instance format
    result.total++;
    const dirValidation = validateProviderInstanceId(providerDir);
    if (!dirValidation.valid) {
      result.invalid++;
      result.violations.push({
        file: `providers/${providerDir}/`,
        identifier: providerDir,
        type: 'provider-instance',
        rule: 'provider-instance-format',
        message: dirValidation.message || 'Invalid provider instance format',
        suggestion: 'Rename directory to follow <capability-id>-<provider-name>'
      });
    } else {
      result.valid++;
    }
    
    // Check provider-manifest.yaml
    const manifestPath = path.join(providersPath, providerDir, 'provider-manifest.yaml');
    if (fs.existsSync(manifestPath)) {
      const content = fs.readFileSync(manifestPath, 'utf-8');
      
      // Check metadata.name
      const nameMatch = content.match(/name:\s*([^\n]+)/);
      if (nameMatch) {
        const name = nameMatch[1].trim();
        result.total++;
        const nameValidation = validateProviderInstanceId(name);
        if (!nameValidation.valid) {
          result.invalid++;
          result.violations.push({
            file: manifestPath.replace(basePath + '/', ''),
            identifier: name,
            type: 'provider-instance',
            rule: 'manifest-name-format',
            message: nameValidation.message || 'Invalid provider name in manifest',
            suggestion: 'Update metadata.name to follow <capability-id>-<provider-name>'
          });
        } else {
          result.valid++;
        }
      }
      
      // Check capability field
      const capabilityMatch = content.match(/^capability:\s*([^\n]+)/m);
      if (capabilityMatch) {
        const capability = capabilityMatch[1].trim();
        result.total++;
        if (!CANONICAL_CAPABILITIES.includes(capability)) {
          result.invalid++;
          result.violations.push({
            file: manifestPath.replace(basePath + '/', ''),
            identifier: capability,
            type: 'capability-id',
            rule: 'canonical-capability',
            message: `Capability must be from canonical set: ${CANONICAL_CAPABILITIES.join(', ')}`,
            suggestion: 'Use one of the 19 canonical capabilities'
          });
        } else {
          result.valid++;
        }
      }
    }
    
    // Check package.json
    const pkgPath = path.join(providersPath, providerDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        result.total++;
        const expectedPkgName = `@mycodexvantaos/${providerDir}`;
        if (pkg.name !== expectedPkgName) {
          result.invalid++;
          result.violations.push({
            file: pkgPath.replace(basePath + '/', ''),
            identifier: pkg.name,
            type: 'package-name',
            rule: 'package-name-format',
            message: `Package name should be ${expectedPkgName}`,
            suggestion: 'Update package.json name to match provider directory'
          });
        } else {
          result.valid++;
        }
      } catch (e) {
        // Skip invalid JSON
      }
    }
  }
  
  return result;
}

/**
 * Scan all packages
 */
function scanPackages(basePath: string): ValidationResult {
  const result: ValidationResult = { total: 0, valid: 0, invalid: 0, violations: [] };
  const packagesPath = path.join(basePath, 'packages');
  
  if (!fs.existsSync(packagesPath)) {
    console.log('  ℹ️  No packages directory found');
    return result;
  }
  
  const packageDirs = fs.readdirSync(packagesPath).filter(f => 
    fs.statSync(path.join(packagesPath, f)).isDirectory()
  );
  
  for (const pkgDir of packageDirs) {
    // Check directory name follows naming convention
    result.total++;
    if (!pkgDir.startsWith('mycodexvantaos-')) {
      result.invalid++;
      result.violations.push({
        file: `packages/${pkgDir}/`,
        identifier: pkgDir,
        type: 'package-directory',
        rule: 'package-directory-prefix',
        message: 'Package directory must start with mycodexvantaos-',
        suggestion: 'Rename directory to start with mycodexvantaos- prefix'
      });
    } else {
      result.valid++;
    }
    
    // Check package.json
    const pkgJsonPath = path.join(packagesPath, pkgDir, 'package.json');
    if (fs.existsSync(pkgJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
        
        // Check package name
        result.total++;
        const pkgValidation = validatePackageName(pkg.name);
        if (!pkgValidation.valid) {
          result.invalid++;
          result.violations.push({
            file: pkgJsonPath.replace(basePath + '/', ''),
            identifier: pkg.name,
            type: 'package-name',
            rule: 'package-name-format',
            message: pkgValidation.message || 'Invalid package name',
            suggestion: 'Use @mycodexvantaos/<package-short-id> format'
          });
        } else {
          result.valid++;
        }
        
        // Check for forbidden dependencies
        if (pkg.dependencies) {
          for (const dep of Object.keys(pkg.dependencies)) {
            if (dep.startsWith('@machine-native-ops/') || 
                dep.startsWith('@codexvanta/') ||
                dep.includes('mycodexvanta-os')) {
              result.total++;
              result.invalid++;
              result.violations.push({
                file: pkgJsonPath.replace(basePath + '/', ''),
                identifier: dep,
                type: 'dependency',
                rule: 'forbidden-dependency',
                message: `Forbidden dependency: ${dep}`,
                suggestion: 'Use @mycodexvantaos/* packages only'
              });
            }
          }
        }
      } catch (e) {
        // Skip invalid JSON
      }
    }
  }
  
  return result;
}

/**
 * Check for forbidden patterns in the codebase
 */
function scanForForbiddenPatterns(basePath: string): ValidationResult {
  const result: ValidationResult = { total: 0, valid: 0, invalid: 0, violations: [] };
  
  // Forbidden patterns that indicate legacy naming
  const forbiddenPatterns = [
    { pattern: /@machine-native-ops\//g, rule: 'legacy-dependency', message: 'Legacy @machine-native-ops/* dependency found' },
    { pattern: /@codexvanta\//g, rule: 'legacy-dependency', message: 'Legacy @codexvanta/* dependency found' },
    { pattern: /mycodexvanta-os/g, rule: 'legacy-naming', message: 'Legacy mycodexvanta-os naming found' },
    { pattern: /codexvanta-os/g, rule: 'legacy-naming', message: 'Legacy codexvanta-os naming found' },
  ];
  
  // Directories to skip entirely (legacy/imported code, generated, etc.)
  const skipDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'project-import', 'deprecated'];
  
  // Files to skip (validation patterns, test fixtures, etc.)
  const skipFiles = ['validator.ts', 'validate-naming.ts'];
  
  function scanFile(filePath: string) {
    // Skip files that are part of validation logic
    const fileName = path.basename(filePath);
    if (skipFiles.includes(fileName)) {
      return;
    }
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      
      for (const { pattern, rule, message } of forbiddenPatterns) {
        const matches = content.match(pattern);
        if (matches) {
          for (const match of matches) {
            result.total++;
            result.invalid++;
            result.violations.push({
              file: filePath.replace(basePath + '/', ''),
              identifier: match,
              type: 'forbidden-pattern',
              rule,
              message,
              suggestion: 'Replace with @mycodexvantaos/* naming'
            });
          }
        }
      }
    } catch (e) {
      // Skip files that can't be read
    }
  }
  
  function scanDir(dirPath: string) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      // Skip configured directories
      if (skipDirs.includes(entry.name)) {
        continue;
      }
      
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.isFile() && /\.(ts|tsx|js|jsx|json|yaml|yml)$/.test(entry.name)) {
        scanFile(fullPath);
      }
    }
  }
  
  scanDir(basePath);
  
  return result;
}

/**
 * Main validation function
 */
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     MyCodexVantaOS Naming Validation (naming-spec-v1)       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  const basePath = path.resolve(__dirname, '..');
  
  // Run all scans
  console.log('📋 Scanning Services...');
  const servicesResult = scanServices(basePath);
  
  console.log('📦 Scanning Providers...');
  const providersResult = scanProviders(basePath);
  
  console.log('📚 Scanning Packages...');
  const packagesResult = scanPackages(basePath);
  
  console.log('🔍 Scanning for Forbidden Patterns...');
  const patternsResult = scanForForbiddenPatterns(basePath);
  
  // Aggregate results
  const total = servicesResult.total + providersResult.total + packagesResult.total + patternsResult.total;
  const valid = servicesResult.valid + providersResult.valid + packagesResult.valid + patternsResult.valid;
  const invalid = servicesResult.invalid + providersResult.invalid + packagesResult.invalid + patternsResult.invalid;
  const allViolations = [
    ...servicesResult.violations,
    ...providersResult.violations,
    ...packagesResult.violations,
    ...patternsResult.violations
  ];
  
  // Print summary
  console.log('\n┌─────────────────────────────────────────────────────────────┐');
  console.log('│                      VALIDATION SUMMARY                     │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log(`│  Services:   ${servicesResult.valid}/${servicesResult.total} valid`.padEnd(61) + '│');
  console.log(`│  Providers:  ${providersResult.valid}/${providersResult.total} valid`.padEnd(61) + '│');
  console.log(`│  Packages:   ${packagesResult.valid}/${packagesResult.total} valid`.padEnd(61) + '│');
  console.log(`│  Patterns:   ${patternsResult.valid}/${patternsResult.total} valid`.padEnd(61) + '│');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log(`│  TOTAL:      ${valid}/${total} valid (${Math.round((valid/Math.max(total,1))*100)}% compliant)`.padEnd(61) + '│');
  console.log('└─────────────────────────────────────────────────────────────┘\n');
  
  // Print violations if any
  if (allViolations.length > 0) {
    console.log('❌ VIOLATIONS FOUND:\n');
    
    // Group by type
    const grouped = allViolations.reduce((acc, v) => {
      if (!acc[v.type]) acc[v.type] = [];
      acc[v.type].push(v);
      return acc;
    }, {} as Record<string, ValidationViolation[]>);
    
    for (const [type, violations] of Object.entries(grouped)) {
      console.log(`  ${type.toUpperCase()} (${violations.length} violations):`);
      for (const v of violations.slice(0, 5)) { // Show max 5 per type
        console.log(`    📄 ${v.file}`);
        console.log(`       "${v.identifier}" - ${v.message}`);
        if (v.suggestion) {
          console.log(`       💡 ${v.suggestion}`);
        }
      }
      if (violations.length > 5) {
        console.log(`    ... and ${violations.length - 5} more`);
      }
      console.log('');
    }
    
    console.log('─'.repeat(60));
    console.log(`Total violations: ${allViolations.length}`);
    console.log('─'.repeat(60) + '\n');
  }
  
  // Final verdict
  if (invalid === 0) {
    console.log('✅ ALL NAMING VALIDATIONS PASSED!\n');
    process.exit(0);
  } else {
    console.log('❌ NAMING VALIDATION FAILED!\n');
    process.exit(1);
  }
}

main().catch(console.error);