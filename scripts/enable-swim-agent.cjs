const fs = require('node:fs');
const path = require('node:path');
const file = path.resolve(__dirname, '../src/services/talents/index.ts');
let source = fs.readFileSync(file, 'utf8');
const importLine = "import {SwimGroupsEngine, SwimNoteDraftEngine, demoSwimAccess} from './SwimAgentEngine';";
const importAnchor = "import {DatetimeEngine} from './DatetimeEngine';";
const registerAnchor = '  talentRegistry.register(new DatetimeEngine());';
if (source.includes(importLine)) { console.log('Swim talents already enabled'); process.exit(0); }
if (source.split(importAnchor).length !== 2 || source.split(registerAnchor).length !== 2) {
  throw new Error('PocketPal changed its talent registration; refusing to modify index.ts');
}
source = source.replace(importAnchor, importAnchor + '\n' + importLine);
source = source.replace(registerAnchor, registerAnchor + '\n  talentRegistry.register(new SwimGroupsEngine(demoSwimAccess));\n  talentRegistry.register(new SwimNoteDraftEngine(demoSwimAccess));');
fs.writeFileSync(file, source);
console.log('Enabled synthetic swim talents. Inspect diff before building.');
