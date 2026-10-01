const fs = require('node:fs');
const path = require('node:path');

const file = path.resolve(__dirname, '../src/services/talents/index.ts');
let source = fs.readFileSync(file, 'utf8');
const importAnchor = "import {DatetimeEngine} from './DatetimeEngine';";
const registerAnchor = '  talentRegistry.register(new DatetimeEngine());';
const importLine = "import {CoachCourseEngine} from './CoachCourseEngine';";
const registerLine = '  talentRegistry.register(new CoachCourseEngine());';

if (
  source.split(importAnchor).length !== 2 ||
  source.split(registerAnchor).length !== 2
) {
  throw new Error(
    'PocketPal changed talent registration: refusing to modify index.ts',
  );
}
const hasImport = source.includes(importLine);
const hasRegister = source.includes(registerLine);
if (hasImport !== hasRegister) {
  throw new Error('Partial integration detected: inspect index.ts manually');
}
if (hasImport) {
  console.log('coach_course is already registered; nothing changed.');
} else {
  source = source.replace(importAnchor, `${importAnchor}\n${importLine}`);
  source = source.replace(registerAnchor, `${registerAnchor}\n${registerLine}`);
  fs.writeFileSync(file, source);
  console.log('coach_course registered. Review the diff and run the checks.');
}
