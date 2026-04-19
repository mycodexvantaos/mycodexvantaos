import * as fs from 'fs';
import * as path from 'path';

function updateKustomization() {
  const servicesDir = path.join(process.cwd(), 'services');
  const baseKustomizationPath = path.join(process.cwd(), 'infra/kubernetes/base/kustomization.yaml');
  
  if (!fs.existsSync(servicesDir)) {
    console.error('Services directory not found');
    return;
  }

  const services = fs.readdirSync(servicesDir)
    .filter(file => fs.statSync(path.join(servicesDir, file)).isDirectory() && file.startsWith('mycodexvantaos-'));

  let kustomizationContent = `apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
`;

  services.forEach(service => {
    // Check if deployment.yaml exists for this service in base
    const deploymentPath = path.join(process.cwd(), 'infra/kubernetes/base/' + service + '/deployment.yaml');
    if (fs.existsSync(deploymentPath)) {
      kustomizationContent += '  - ' + service + '/deployment.yaml\n';
    }
  });

  fs.writeFileSync(baseKustomizationPath, kustomizationContent, 'utf8');
  console.log('Successfully updated kustomization.yaml with existing dynamic service deployments.');
}

updateKustomization();
