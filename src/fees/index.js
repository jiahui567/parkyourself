// Parking fee rules (PLAN.md, "Fee calculator"). Pure functions: no database
// or React code, so every rule is covered by Jest tests.
export { assertValidRate, calcDayFeeSen, calcStayFee } from './calcFee';
export { dayTypeOf } from './dayType';
export { amountPaidText, missingRateTypes, readEndForm, savesMissingRate, typedRates } from './endForm';
export { feeSoFar } from './feeSoFar';
export { enteredRates, offersSameEveryDay, rateDayTypeFor, ratesToSave } from './parkRates';
export { changedPlaceRates, placeRatesFormFrom, ratesFromPlaceRatesForm } from './placeRatesForm';
export {
  DAY_TYPES,
  EMPTY_RATE_FORM,
  feeFields,
  formFromRate,
  hasMoreRateOptions,
  HOLIDAY_AMOUNT_ERROR,
  holidayRate,
  holidayRateFromText,
  isRateFormEmpty,
  moreRateOptionsInUse,
  planRateSave,
  rateFromForm,
  sameRate,
} from './rateForm';
export { mergeRates, ratesFromSnapshot, sessionFee, snapshotText } from './sessionFee';
