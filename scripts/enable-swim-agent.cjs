const fs = require('node:fs');
const path = require('node:path');
const file = path.resolve(__dirname, '../src/services/talents/index.ts');
let source = fs.readFileSync(file, 'utf8');
const importAnchor = "import {DatetimeEngine} from './DatetimeEngine';";
const registerAnchor = '  talentRegistry.register(new DatetimeEngine());';
const additions = [
  {importLine: "import {SwimGroupsEngine, SwimNoteDraftEngine, demoSwimAccess} from './SwimAgentEngine';",
    registerLine: '  talentRegistry.register(new SwimGroupsEngine(demoSwimAccess));\n  talentRegistry.register(new SwimNoteDraftEngine(demoSwimAccess));'},
  {importLine: "import {CoachWorkspaceEngine} from './CoachWorkspaceEngine';",
    registerLine: '  talentRegistry.register(new CoachWorkspaceEngine());'},
];
if (source.split(importAnchor).length !== 2 || source.split(registerAnchor).length !== 2) {
  throw new Error('PocketPal changed talent registration: refusing to modify index.ts');
}
for (const addition of additions) {
  const hasImport = source.includes(addition.importLine);
  const hasRegister = source.includes(addition.registerLine.split('\n')[0]);
  if (hasImport !== hasRegister) throw new Error('Partial integration detected: inspect index.ts manually');
  if (!hasImport) {
    source = source.replace(importAnchor, importAnchor + '\n' + addition.importLine);
    source = source.replace(registerAnchor, registerAnchor + '\n' + addition.registerLine);
  }
}
fs.writeFileSync(file, source);
console.log('Synthetic swim/coach talents registered. Review diff and run checks before building.');
