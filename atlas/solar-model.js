/*
 * Pure solar geometry for the classroom atlas. No network or DOM dependencies.
 * Declination: NOAA General Solar Position Calculations, annual Fourier fit:
 * https://gml.noaa.gov/grad/solcalc/solareqns.PDF
 * gamma = 2*pi/365*(dayOfYear-1), evaluated at hour=12 in a non-leap year.
 * Each displayed month uses its 15th day unless an explicit day is supplied.
 * Declination is held constant during the representative solar day.
 *
 * Daylight means the solar CENTRE geometrically above a flat horizon. This is
 * deliberately not a sunrise/sunset almanac: no atmospheric refraction, solar
 * disk radius, twilight, terrain horizon, observer height or time-zone offsets.
 * The conventional observed sunrise uses a different threshold, documented at:
 * https://aa.usno.navy.mil/faq/RST_defs
 * Longitude does not change day length or maximum solar altitude on this date;
 * it changes the civil/UTC time of solar noon, which this model does not report.
 * Negative noon altitude means that even the day's highest Sun is below horizon.
 */
(function (root, factory) {
 'use strict';
 const api = factory();
 if (typeof module === 'object' && module.exports) module.exports = api;
 if (root) root.AtlasSolar = api;
})(typeof window === 'object' ? window : null, function () {
 'use strict';
 const RAD = Math.PI / 180;
 const MONTH_DAYS = Object.freeze([31,28,31,30,31,30,31,31,30,31,30,31]);
 const EPS = 1e-12;
 function finiteRange(value, min, max, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
   throw new RangeError(label + ' must be a finite number in [' + min + ', ' + max + ']');
  return value;
 }
 function dayOfYear(month, day = 15) {
  if (!Number.isInteger(month) || month < 1 || month > 12)
   throw new RangeError('month must be an integer from 1 to 12');
  if (!Number.isInteger(day) || day < 1 || day > MONTH_DAYS[month - 1])
   throw new RangeError('day must be valid in a non-leap year');
  return MONTH_DAYS.slice(0, month - 1).reduce((a, b) => a + b, day);
 }
 function declinationForDate(month, day = 15) {
  const g = 2 * Math.PI / 365 * (dayOfYear(month, day) - 1);
  const d = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g)
   - 0.006758 * Math.cos(2*g) + 0.000907 * Math.sin(2*g)
   - 0.002697 * Math.cos(3*g) + 0.00148 * Math.sin(3*g);
  return d / RAD;
 }
 function daylightHoursAt(latitude, declination) {
  finiteRange(latitude, -90, 90, 'latitude');
  finiteRange(declination, -90, 90, 'declination');
  const p = latitude * RAD, d = declination * RAD;
  // At any solar hour angle h, sin(altitude) = a + b*cos(h).
  const a = Math.sin(p) * Math.sin(d), b = Math.cos(p) * Math.cos(d);
  // Avoid tan(90 degrees). If the centre stays exactly on the horizon all day
  // (ideal equinox at a pole), it is never above it: zero geometric daylight.
  if (Math.abs(b) < EPS) return a > EPS ? 24 : 0;
  const crossing = -a / b;
  if (crossing >= 1) return 0;
  if (crossing <= -1) return 24;
  return 24 * Math.acos(crossing) / Math.PI;
 }
 function solarNoonAltitudeAt(latitude, declination) {
  finiteRange(latitude, -90, 90, 'latitude');
  finiteRange(declination, -90, 90, 'declination');
  return 90 - Math.abs(latitude - declination);
 }
 function metrics(longitude, latitude, month, day = 15) {
  finiteRange(longitude, -180, 180, 'longitude');
  finiteRange(latitude, -90, 90, 'latitude');
  const declination = declinationForDate(month, day);
  const daylightHours = daylightHoursAt(latitude, declination);
  const solarNoonAltitude = solarNoonAltitudeAt(latitude, declination);
  return {
   longitude, latitude, month, day,
   declination, subsolarLatitude: declination, daylightHours,
   solarNoonAltitude, noonSunVisible: solarNoonAltitude > EPS,
   polarDay: daylightHours === 24, polarNight: daylightHours === 0
  };
 }
 return Object.freeze({
  version: 1,
  dayOfYear, declinationForDate, daylightHoursAt, solarNoonAltitudeAt, metrics,
  assumptions: Object.freeze({yearLength:365,representativeDay:15,refraction:false,solarDisk:false,terrainHorizon:false}),
  sources: Object.freeze([
   'https://gml.noaa.gov/grad/solcalc/solareqns.PDF',
   'https://aa.usno.navy.mil/faq/RST_defs'
  ])
 });
});
