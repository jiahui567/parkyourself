// Parking fee rules (PLAN.md, "Fee calculator"). Pure functions: no database
// or React code, so every rule is covered by Jest tests.
export { assertValidRate, calcDayFeeSen, calcStayFee } from './calcFee';
export { dayTypeOf } from './dayType';
