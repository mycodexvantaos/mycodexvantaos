import { RegexTable } from './utils/regex-table';
import * as fs from 'fs';
import * as path from 'path';

function validateServices() {
  const servicesPath = path.join(__dirname, '../services');
  if (!fs.existsSync(servicesPath)) return;
  
  const services = fs.readdirSync(servicesPath);
  let failed = false;
  for (const service of services) {
    if (!RegexTable.SERVICE_ID.test(service)) {
      console.error(`[HARD ENFORCEMENT FAILED] Invalid service id: ${service}`);
      failed = true;
    } else {
      console.log(`[PASS] ${service}`);
    }
  }
  
  if (failed) {
    process.exit(1);
  }
}

console.log('Validating Architecture...');
validateServices();
console.log('Architecture passes validation.');
