import type { VacationIcon, SwedishHoliday } from './types';

export const VACATION_ICONS: { icon: VacationIcon; label: string }[] = [
    { icon: '🏡', label: 'Stuga' },
    { icon: '🎣', label: 'Fiske' },
    { icon: '🏖️', label: 'Strand' },
    { icon: '⛰️', label: 'Vandring' },
    { icon: '🏙️', label: 'Stadsresa' },
    { icon: '🚗', label: 'Bilsemester' },
    { icon: '✈️', label: 'Utomlands' },
    { icon: '⛷️', label: 'Skidresa' },
    { icon: '🎉', label: 'Festival' },
    { icon: '⛵', label: 'Båt' },
];

export function isValidVacationIcon(value: string): value is VacationIcon {
    return VACATION_ICONS.some((v) => v.icon === value);
}

const MS_PER_DAY = 86400000;

// Meeus/Jones/Butcher Gregorian Easter algorithm — returns UTC midnight Date of Easter Sunday.
export function computeEasterSunday(year: number): Date {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=March, 4=April
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date: Date, n: number): Date {
    return new Date(date.getTime() + n * MS_PER_DAY);
}

function toISODate(date: Date): string {
    return date.toISOString().slice(0, 10);
}

// First date within [fromDay, toDay] of the given UTC month (0-indexed) matching targetDow (0=Sun..6=Sat).
function firstWeekdayInRange(year: number, month0: number, fromDay: number, toDay: number, targetDow: number): Date {
    for (let d = fromDay; d <= toDay; d++) {
        const candidate = new Date(Date.UTC(year, month0, d));
        if (candidate.getUTCDay() === targetDow) return candidate;
    }
    throw new Error(`No weekday ${targetDow} found in range`);
}

// All Saints' Day: the Saturday falling between Oct 31 and Nov 6 (crosses the month boundary).
function allSaintsDay(year: number): Date {
    const oct31 = new Date(Date.UTC(year, 9, 31));
    if (oct31.getUTCDay() === 6) return oct31;
    return firstWeekdayInRange(year, 10, 1, 6, 6);
}

export function getSwedishHolidays(year: number): SwedishHoliday[] {
    const easter = computeEasterSunday(year);

    return [
        { date: toISODate(new Date(Date.UTC(year, 0, 1))), name: 'Nyårsdagen' },
        { date: toISODate(new Date(Date.UTC(year, 0, 6))), name: 'Trettondedag jul' },
        { date: toISODate(addDays(easter, -2)), name: 'Långfredagen' },
        { date: toISODate(easter), name: 'Påskdagen' },
        { date: toISODate(addDays(easter, 1)), name: 'Annandag påsk' },
        { date: toISODate(new Date(Date.UTC(year, 4, 1))), name: 'Första maj' },
        { date: toISODate(addDays(easter, 39)), name: 'Kristi himmelsfärdsdag' },
        { date: toISODate(new Date(Date.UTC(year, 5, 6))), name: 'Sveriges nationaldag' },
        { date: toISODate(firstWeekdayInRange(year, 5, 19, 25, 5)), name: 'Midsommarafton' },
        { date: toISODate(firstWeekdayInRange(year, 5, 20, 26, 6)), name: 'Midsommardagen' },
        { date: toISODate(allSaintsDay(year)), name: 'Alla helgons dag' },
        { date: toISODate(new Date(Date.UTC(year, 11, 24))), name: 'Julafton' },
        { date: toISODate(new Date(Date.UTC(year, 11, 25))), name: 'Juldagen' },
        { date: toISODate(new Date(Date.UTC(year, 11, 26))), name: 'Annandag jul' },
        { date: toISODate(new Date(Date.UTC(year, 11, 31))), name: 'Nyårsafton' },
    ];
}

// ISO-8601 week number (Monday-start weeks, week 1 = week containing the year's first Thursday).
export function getISOWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayNum = (d.getUTCDay() + 6) % 7; // Mon=0..Sun=6
    d.setUTCDate(d.getUTCDate() - dayNum + 3); // Thursday of this ISO week
    const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
    firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
    return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * MS_PER_DAY));
}
