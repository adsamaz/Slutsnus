import { createSignal, createMemo, createResource, For, Show, onMount, onCleanup } from 'solid-js';
import { A } from '@solidjs/router';
import { useAuth } from '../stores/auth';
import { showToast } from '../components/Toast';
import Avatar from '../components/Avatar';
import Button from '../components/Button';
import {
    VACATION_ICONS,
    getSwedishHolidays,
    getISOWeekNumber,
} from '@slutsnus/shared';
import type {
    VacationEntryData,
    VacationUserOption,
    CreateVacationEntryRequest,
    VacationIcon,
} from '@slutsnus/shared';

const USER_COLORS = ['#39d353', '#ffa657', '#58a6ff', '#ff7b72', '#bc8cff', '#e3b341', '#39c5cf', '#f778ba'];
const WEEKDAY_LABELS = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];
const MS_PER_DAY = 86400000;

// ─── UTC date helpers (no time-of-day component, matches BulkSisters convention) ───

function utcDate(year: number, month0: number, day: number): Date {
    return new Date(Date.UTC(year, month0, day));
}

function addDaysUTC(date: Date, n: number): Date {
    return new Date(date.getTime() + n * MS_PER_DAY);
}

function ymd(date: Date): string {
    return date.toISOString().slice(0, 10);
}

function parseYmd(dateStr: string): Date {
    return new Date(`${dateStr}T00:00:00.000Z`);
}

function mondayIndex(date: Date): number {
    return (date.getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
}

function todayUTC(): Date {
    const d = new Date();
    return utcDate(d.getFullYear(), d.getMonth(), d.getDate());
}

// ─── Data fetching ──────────────────────────────────────────────────────────────

async function fetchEntries(start: string, end: string): Promise<VacationEntryData[]> {
    const res = await fetch(`/api/vacations?start=${start}&end=${end}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Kunde inte hämta semesterdata');
    return res.json();
}

async function fetchUserOptions(): Promise<VacationUserOption[]> {
    const res = await fetch('/api/vacations/users', { credentials: 'include' });
    if (!res.ok) throw new Error('Kunde inte hämta personer');
    return res.json();
}

async function extractError(res: Response, fallback: string): Promise<string> {
    try {
        const data = await res.json() as { error?: string };
        return data.error ?? fallback;
    } catch {
        return fallback;
    }
}

async function createEntryReq(body: CreateVacationEntryRequest): Promise<VacationEntryData> {
    const res = await fetch('/api/vacations', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await extractError(res, 'Kunde inte skapa semestern'));
    return res.json();
}

async function updateEntryReq(id: string, body: CreateVacationEntryRequest): Promise<VacationEntryData> {
    const res = await fetch(`/api/vacations/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await extractError(res, 'Kunde inte uppdatera semestern'));
    return res.json();
}

async function deleteEntryReq(id: string): Promise<void> {
    const res = await fetch(`/api/vacations/${id}`, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) throw new Error(await extractError(res, 'Kunde inte ta bort semestern'));
}

async function setHiddenReq(userId: string, hide: boolean): Promise<void> {
    const res = await fetch(`/api/vacations/hidden-users/${userId}`, {
        method: hide ? 'POST' : 'DELETE',
        credentials: 'include',
    });
    if (!res.ok) throw new Error(await extractError(res, 'Kunde inte uppdatera inställningen'));
}

// ─── Calendar grid model ────────────────────────────────────────────────────────

interface GridDay {
    date: Date;
    inCurrentMonth: boolean;
}

interface GridWeek {
    weekNumber: number;
    days: GridDay[];
}

function buildMonthGrid(year: number, month0: number): GridWeek[] {
    const firstOfMonth = utcDate(year, month0, 1);
    const lastOfMonth = utcDate(year, month0 + 1, 0);
    const gridStart = addDaysUTC(firstOfMonth, -mondayIndex(firstOfMonth));
    const gridEnd = addDaysUTC(lastOfMonth, 6 - mondayIndex(lastOfMonth));

    const weeks: GridWeek[] = [];
    let cursor = gridStart;
    while (cursor.getTime() <= gridEnd.getTime()) {
        const days: GridDay[] = [];
        for (let i = 0; i < 7; i++) {
            days.push({ date: cursor, inCurrentMonth: cursor.getUTCMonth() === month0 && cursor.getUTCFullYear() === year });
            cursor = addDaysUTC(cursor, 1);
        }
        weeks.push({ weekNumber: getISOWeekNumber(days[0].date), days });
    }
    return weeks;
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function VacationCalendar() {
    const [auth] = useAuth();
    const today = todayUTC();
    const todayStr = ymd(today);

    const [viewYear, setViewYear] = createSignal(today.getUTCFullYear());
    const [viewMonth0, setViewMonth0] = createSignal(today.getUTCMonth());

    const weeks = createMemo(() => buildMonthGrid(viewYear(), viewMonth0()));
    const gridStart = createMemo(() => weeks()[0].days[0].date);
    const gridEnd = createMemo(() => {
        const w = weeks();
        return w[w.length - 1].days[6].date;
    });

    const [entries, { refetch: refetchEntries }] = createResource(
        () => [ymd(gridStart()), ymd(gridEnd())] as [string, string],
        ([start, end]) => fetchEntries(start, end),
    );

    const [userOptions, { refetch: refetchUserOptions }] = createResource(
        () => (auth.user ? auth.user.id : false),
        () => fetchUserOptions(),
    );

    const monthLabel = createMemo(() =>
        utcDate(viewYear(), viewMonth0(), 1).toLocaleDateString('sv-SE', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    );

    function prevMonth() {
        let m = viewMonth0() - 1;
        let y = viewYear();
        if (m < 0) { m = 11; y -= 1; }
        setViewMonth0(m);
        setViewYear(y);
    }

    function nextMonth() {
        let m = viewMonth0() + 1;
        let y = viewYear();
        if (m > 11) { m = 0; y += 1; }
        setViewMonth0(m);
        setViewYear(y);
    }

    const holidaysMap = createMemo(() => {
        const years = new Set([gridStart().getUTCFullYear(), gridEnd().getUTCFullYear()]);
        const map = new Map<string, string>();
        years.forEach((y) => getSwedishHolidays(y).forEach((h) => map.set(h.date, h.name)));
        return map;
    });

    const entriesByDate = createMemo(() => {
        const map = new Map<string, VacationEntryData[]>();
        const gs = gridStart().getTime();
        const ge = gridEnd().getTime();
        for (const entry of entries() ?? []) {
            const from = Math.max(parseYmd(entry.startDate).getTime(), gs);
            const to = Math.min(parseYmd(entry.endDate).getTime(), ge);
            for (let t = from; t <= to; t += MS_PER_DAY) {
                const key = ymd(new Date(t));
                const arr = map.get(key) ?? [];
                arr.push(entry);
                map.set(key, arr);
            }
        }
        return map;
    });

    const userColorMap = createMemo(() => {
        const usernameById = new Map<string, string>();
        for (const e of entries() ?? []) {
            if (!usernameById.has(e.userId)) usernameById.set(e.userId, e.username);
        }
        const sorted = Array.from(usernameById.entries()).sort((a, b) => a[1].localeCompare(b[1]));
        const map = new Map<string, string>();
        sorted.forEach(([userId], i) => map.set(userId, USER_COLORS[i % USER_COLORS.length]));
        return map;
    });

    // ─── Drag-to-select ───
    const [dragStart, setDragStart] = createSignal<Date | null>(null);
    const [dragEnd, setDragEnd] = createSignal<Date | null>(null);
    const [isDragging, setIsDragging] = createSignal(false);

    const dragBounds = createMemo<[Date, Date] | null>(() => {
        const s = dragStart();
        const e = dragEnd();
        if (!s || !e) return null;
        return s.getTime() <= e.getTime() ? [s, e] : [e, s];
    });

    function isCellDragging(date: Date): boolean {
        const bounds = dragBounds();
        if (!bounds || !isDragging()) return false;
        return date.getTime() >= bounds[0].getTime() && date.getTime() <= bounds[1].getTime();
    }

    function handleDragStart(date: Date) {
        if (!auth.user) return;
        setDragStart(date);
        setDragEnd(date);
        setIsDragging(true);
    }

    function handleDragEnter(date: Date) {
        if (isDragging()) setDragEnd(date);
    }

    function handleMouseUp() {
        if (!isDragging()) return;
        const bounds = dragBounds();
        setIsDragging(false);
        setDragStart(null);
        setDragEnd(null);
        if (bounds) openCreatePopover(bounds[0], bounds[1]);
    }

    onMount(() => document.addEventListener('mouseup', handleMouseUp));
    onCleanup(() => document.removeEventListener('mouseup', handleMouseUp));

    // ─── Create / edit popover ───
    const [pendingRange, setPendingRange] = createSignal<{ start: Date; end: Date } | null>(null);
    const [editingEntry, setEditingEntry] = createSignal<VacationEntryData | null>(null);
    const [formIcon, setFormIcon] = createSignal<VacationIcon>(VACATION_ICONS[0].icon);
    const [formTitle, setFormTitle] = createSignal('');
    const [saving, setSaving] = createSignal(false);

    function openCreatePopover(start: Date, end: Date) {
        setFormIcon(VACATION_ICONS[0].icon);
        setFormTitle('');
        setPendingRange({ start, end });
    }

    function openEditPopover(entry: VacationEntryData) {
        setFormIcon(entry.icon);
        setFormTitle(entry.title ?? '');
        setEditingEntry(entry);
    }

    function closePopover() {
        setPendingRange(null);
        setEditingEntry(null);
    }

    const rangeLabel = createMemo(() => {
        const range = pendingRange();
        const editing = editingEntry();
        const fmt = (d: Date) => d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', timeZone: 'UTC' });
        if (range) return `${fmt(range.start)} – ${fmt(range.end)}`;
        if (editing) return `${fmt(parseYmd(editing.startDate))} – ${fmt(parseYmd(editing.endDate))}`;
        return '';
    });

    async function handleSubmit() {
        const range = pendingRange();
        const editing = editingEntry();
        const title = formTitle().trim().slice(0, 60);
        setSaving(true);
        try {
            if (range) {
                await createEntryReq({ startDate: ymd(range.start), endDate: ymd(range.end), icon: formIcon(), title: title || undefined });
                showToast('Semester tillagd! 🌴', 'success');
            } else if (editing) {
                await updateEntryReq(editing.id, { startDate: editing.startDate, endDate: editing.endDate, icon: formIcon(), title: title || undefined });
                showToast('Semester uppdaterad', 'success');
            }
            closePopover();
            await refetchEntries();
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Något gick fel', 'error');
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete() {
        const editing = editingEntry();
        if (!editing) return;
        setSaving(true);
        try {
            await deleteEntryReq(editing.id);
            showToast('Semester borttagen', 'success');
            closePopover();
            await refetchEntries();
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Något gick fel', 'error');
        } finally {
            setSaving(false);
        }
    }

    // ─── Hidden-users panel ───
    const [hidePanelOpen, setHidePanelOpen] = createSignal(false);

    async function handleToggleHide(user: VacationUserOption) {
        try {
            await setHiddenReq(user.id, !user.hidden);
            await Promise.all([refetchUserOptions(), refetchEntries()]);
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Något gick fel', 'error');
        }
    }

    return (
        <main class="page">
            <h2 class="page-title">Semesterkalender 🌴</h2>

            <Show when={!auth.user}>
                <p class="muted vacation-login-banner">
                    Logga in för att lägga till din egen semester — <A href="/login">Logga in</A>
                </p>
            </Show>

            <div class="vacation-toolbar">
                <Button variant="secondary" onClick={prevMonth}>‹</Button>
                <span class="vacation-month-label">{monthLabel()}</span>
                <Button variant="secondary" onClick={nextMonth}>›</Button>
                <Show when={auth.user}>
                    <Button variant="secondary" class="vacation-hide-toggle" onClick={() => setHidePanelOpen((o) => !o)}>
                        Dölj personer
                    </Button>
                </Show>
            </div>

            <Show when={hidePanelOpen() && auth.user}>
                <div class="card vacation-hide-panel">
                    <Show when={userOptions.loading}>
                        <p class="muted">Laddar...</p>
                    </Show>
                    <For each={userOptions()}>
                        {(u) => (
                            <div class="friend-item">
                                <Avatar username={u.username} avatarUrl={u.avatarUrl} />
                                <span>{u.username}</span>
                                <Button
                                    variant={u.hidden ? 'secondary' : 'danger'}
                                    style={{ 'margin-left': 'auto', padding: '4px 10px', 'font-size': '0.8rem' }}
                                    onClick={() => handleToggleHide(u)}
                                >
                                    {u.hidden ? 'Visa igen' : 'Dölj'}
                                </Button>
                            </div>
                        )}
                    </For>
                </div>
            </Show>

            <Show when={entries.error}>
                <p class="error-text">Kunde inte hämta semesterdata</p>
            </Show>

            <div class="vacation-grid">
                <div class="vacation-grid-header vacation-week-num" />
                <For each={WEEKDAY_LABELS}>{(label) => <div class="vacation-grid-header">{label}</div>}</For>

                <For each={weeks()}>
                    {(week) => (
                        <>
                            <div class="vacation-week-num">{week.weekNumber}</div>
                            <For each={week.days}>
                                {(day) => {
                                    const dateStr = ymd(day.date);
                                    const holidayName = () => holidaysMap().get(dateStr);
                                    const dayEntries = () => entriesByDate().get(dateStr) ?? [];
                                    const dow = day.date.getUTCDay();
                                    const isWeekend = dow === 0 || dow === 6;
                                    const isToday = dateStr === todayStr;

                                    return (
                                        <div
                                            class={[
                                                'vacation-day-cell',
                                                !day.inCurrentMonth && 'vacation-day-cell--other-month',
                                                isToday && 'vacation-day-cell--today',
                                                isWeekend && 'vacation-day-cell--weekend',
                                                holidayName() && 'vacation-day-cell--holiday',
                                                isCellDragging(day.date) && 'vacation-day-cell--drag-selecting',
                                            ].filter(Boolean).join(' ')}
                                            title={holidayName() ?? undefined}
                                            onMouseDown={() => day.inCurrentMonth && handleDragStart(day.date)}
                                            onMouseEnter={() => day.inCurrentMonth && handleDragEnter(day.date)}
                                        >
                                            <div class="vacation-day-num">{day.date.getUTCDate()}</div>
                                            <Show when={holidayName()}>
                                                <div class="vacation-holiday-label">{holidayName()}</div>
                                            </Show>
                                            <div class="vacation-entry-chips">
                                                <For each={dayEntries().slice(0, 3)}>
                                                    {(entry) => (
                                                        <div
                                                            class={`vacation-entry-chip${entry.isMine ? ' vacation-entry-chip--mine' : ''}`}
                                                            style={{ '--user-color': userColorMap().get(entry.userId) ?? USER_COLORS[0] }}
                                                            title={`${entry.username}: ${entry.title ?? ''} (${entry.startDate} – ${entry.endDate})`}
                                                            onMouseDown={(e) => e.stopPropagation()}
                                                            onClick={(e) => { e.stopPropagation(); if (entry.isMine) openEditPopover(entry); }}
                                                        >
                                                            <span>{entry.icon}</span>
                                                            <span class="vacation-entry-chip-title">{entry.title ?? entry.username}</span>
                                                        </div>
                                                    )}
                                                </For>
                                                <Show when={dayEntries().length > 3}>
                                                    <div class="vacation-entry-more">+{dayEntries().length - 3}</div>
                                                </Show>
                                            </div>
                                        </div>
                                    );
                                }}
                            </For>
                        </>
                    )}
                </For>
            </div>

            <Show when={pendingRange() || editingEntry()}>
                <div class="vacation-popover-overlay" onClick={closePopover}>
                    <div class="vacation-popover" onClick={(e) => e.stopPropagation()}>
                        <h3>{editingEntry() ? 'Redigera semester' : 'Ny semester'}</h3>
                        <p class="muted">{rangeLabel()}</p>
                        <div class="vacation-icon-grid">
                            <For each={VACATION_ICONS}>
                                {(opt) => (
                                    <button
                                        type="button"
                                        class={`vacation-icon-btn${formIcon() === opt.icon ? ' vacation-icon-btn--selected' : ''}`}
                                        title={opt.label}
                                        onClick={() => setFormIcon(opt.icon)}
                                    >
                                        {opt.icon}
                                    </button>
                                )}
                            </For>
                        </div>
                        <input
                            class="input"
                            placeholder="Titel (valfritt)"
                            maxLength={60}
                            value={formTitle()}
                            onInput={(e) => setFormTitle(e.currentTarget.value)}
                        />
                        <div class="vacation-popover-actions">
                            <Show when={editingEntry()}>
                                <Button variant="danger" disabled={saving()} onClick={handleDelete}>Ta bort</Button>
                            </Show>
                            <Button variant="secondary" disabled={saving()} onClick={closePopover}>Avbryt</Button>
                            <Button variant="primary" disabled={saving()} onClick={handleSubmit}>
                                {editingEntry() ? 'Spara' : 'Skapa'}
                            </Button>
                        </div>
                    </div>
                </div>
            </Show>
        </main>
    );
}
