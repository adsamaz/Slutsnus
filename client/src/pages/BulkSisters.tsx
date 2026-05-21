import { createResource, createSignal, For, Show } from 'solid-js';

const USER_COLORS = ['#39d353', '#ffa657', '#58a6ff', '#ff7b72', '#bc8cff', '#e3b341', '#39c5cf', '#f778ba'];

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];

const THIRTY_DAYS_AGO = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return d.toISOString().slice(0, 10);
})();

function dateOffsetDays(dateStr: string): number {
    const [y, m, d] = dateStr.split('-').map(Number);
    const [y0, m0, d0] = THIRTY_DAYS_AGO.split('-').map(Number);
    return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y0, m0 - 1, d0)) / 86400000);
}

interface MonthEntry {
    month: string;
    avgWeight: number;
}

interface DayEntry {
    date: string;
    weightKg: number;
}

interface BulkEntry {
    username: string;
    displayName: string | null;
    profilePicturePath: string | null;
    months: MonthEntry[];
    days: DayEntry[];
}

async function fetchCommunity(): Promise<BulkEntry[]> {
    const res = await fetch('/api/bulk-sisters/community');
    if (!res.ok) throw new Error('Failed to load community data');
    return res.json() as Promise<BulkEntry[]>;
}

function formatMonth(month: string): string {
    const [year, m] = month.split('-');
    return `${MONTH_NAMES[parseInt(m) - 1]} '${year.slice(2)}`;
}

// ─── SVG chart ────────────────────────────────────────────────────────────────

const PAD = { left: 50, right: 24, top: 20, bottom: 50 };
const VW = 700, VH = 300;
const chartW = VW - PAD.left - PAD.right;
const chartH = VH - PAD.top - PAD.bottom;

function WeightChart(props: { data: BulkEntry[] }) {
    const months = () => {
        const s = new Set<string>();
        props.data.forEach(e => e.months.forEach(m => s.add(m.month)));
        return Array.from(s).sort();
    };

    const weights = () => props.data.flatMap(e => e.months.map(m => m.avgWeight));

    const minW = () => {
        const ws = weights();
        return ws.length === 0 ? 60 : Math.floor(Math.min(...ws) - 2);
    };
    const maxW = () => {
        const ws = weights();
        return ws.length === 0 ? 100 : Math.ceil(Math.max(...ws) + 2);
    };

    const xPos = (idx: number) => {
        const total = months().length;
        return PAD.left + (total <= 1 ? chartW / 2 : (idx / (total - 1)) * chartW);
    };

    const yPos = (weight: number) =>
        PAD.top + chartH - ((weight - minW()) / Math.max(maxW() - minW(), 1)) * chartH;

    const yTicks = () => {
        const min = minW(), max = maxW();
        const step = Math.max(1, Math.ceil((max - min) / 4));
        return Array.from({ length: 5 }, (_, i) => min + i * step);
    };

    const skipEvery = () => Math.max(1, Math.ceil(months().length / 8));

    const userPoints = (entry: BulkEntry) => {
        const ms = months();
        const wMap = new Map(entry.months.map(m => [m.month, m.avgWeight]));
        return ms
            .map((m, i) => {
                const w = wMap.get(m);
                if (w == null) return null;
                return { x: xPos(i), y: yPos(w), w, month: m };
            })
            .filter((p): p is NonNullable<typeof p> => p !== null);
    };

    return (
        <svg viewBox={`0 0 ${VW} ${VH}`} class="bulk-sisters-chart" aria-label="Weight over time">
            <For each={yTicks()}>
                {(tick) => (
                    <>
                        <line
                            x1={PAD.left} y1={yPos(tick)}
                            x2={VW - PAD.right} y2={yPos(tick)}
                            class="bulk-chart-grid"
                        />
                        <text
                            x={PAD.left - 8}
                            y={yPos(tick) + 4}
                            class="bulk-chart-label"
                            text-anchor="end"
                        >
                            {tick}
                        </text>
                    </>
                )}
            </For>

            <For each={months()}>
                {(month, i) => (
                    <Show when={i() % skipEvery() === 0}>
                        <text
                            x={xPos(i())}
                            y={VH - PAD.bottom + 18}
                            class="bulk-chart-label"
                            text-anchor="middle"
                        >
                            {formatMonth(month)}
                        </text>
                    </Show>
                )}
            </For>

            <For each={props.data}>
                {(entry, ui) => {
                    const pts = () => userPoints(entry);
                    const color = USER_COLORS[ui() % USER_COLORS.length];
                    return (
                        <g>
                            <polyline
                                points={pts().map(p => `${p.x},${p.y}`).join(' ')}
                                fill="none"
                                stroke={color}
                                stroke-width="2.5"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                opacity="0.9"
                            />
                            <For each={pts()}>
                                {(p) => (
                                    <circle cx={p.x} cy={p.y} r="3.5" fill={color}>
                                        <title>{entry.displayName ?? entry.username}: {p.w.toFixed(1)} kg ({formatMonth(p.month)})</title>
                                    </circle>
                                )}
                            </For>
                        </g>
                    );
                }}
            </For>

            {/* Axes */}
            <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={VH - PAD.bottom} class="bulk-chart-axis" />
            <line x1={PAD.left} y1={VH - PAD.bottom} x2={VW - PAD.right} y2={VH - PAD.bottom} class="bulk-chart-axis" />
        </svg>
    );
}

// ─── Daily chart (last 30 days) ───────────────────────────────────────────────

function DailyChart(props: { data: BulkEntry[] }) {
    const filtered = () => props.data.map(entry => ({
        ...entry,
        days: entry.days
            .filter(d => d.date >= THIRTY_DAYS_AGO)
            .sort((a, b) => a.date.localeCompare(b.date)),
    }));

    const allWeights = () => filtered().flatMap(e => e.days.map(d => d.weightKg));

    const minW = () => {
        const ws = allWeights();
        return ws.length === 0 ? 60 : Math.floor(Math.min(...ws) - 2);
    };
    const maxW = () => {
        const ws = allWeights();
        return ws.length === 0 ? 100 : Math.ceil(Math.max(...ws) + 2);
    };

    const xPos = (dateStr: string) =>
        PAD.left + (dateOffsetDays(dateStr) / 29) * chartW;

    const yPos = (weight: number) =>
        PAD.top + chartH - ((weight - minW()) / Math.max(maxW() - minW(), 1)) * chartH;

    const yTicks = () => {
        const min = minW(), max = maxW();
        const step = Math.max(1, Math.ceil((max - min) / 4));
        return Array.from({ length: 5 }, (_, i) => min + i * step);
    };

    const xLabels = () => {
        const [y0, m0, d0] = THIRTY_DAYS_AGO.split('-').map(Number);
        return [0, 5, 10, 15, 20, 25, 29].map(offset => ({
            x: PAD.left + (offset / 29) * chartW,
            label: new Date(Date.UTC(y0, m0 - 1, d0 + offset))
                .toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
        }));
    };

    return (
        <svg viewBox={`0 0 ${VW} ${VH}`} class="bulk-sisters-chart" aria-label="Weight last 30 days">
            <For each={yTicks()}>
                {(tick) => (
                    <>
                        <line x1={PAD.left} y1={yPos(tick)} x2={VW - PAD.right} y2={yPos(tick)} class="bulk-chart-grid" />
                        <text x={PAD.left - 8} y={yPos(tick) + 4} class="bulk-chart-label" text-anchor="end">{tick}</text>
                    </>
                )}
            </For>
            <For each={xLabels()}>
                {(lbl) => (
                    <text x={lbl.x} y={VH - PAD.bottom + 18} class="bulk-chart-label" text-anchor="middle">{lbl.label}</text>
                )}
            </For>
            <For each={filtered()}>
                {(entry, ui) => {
                    const color = USER_COLORS[ui() % USER_COLORS.length];
                    const pts = entry.days.map(d => ({
                        x: xPos(d.date),
                        y: yPos(d.weightKg),
                        w: d.weightKg,
                        date: d.date,
                    }));
                    const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');
                    return (
                        <g>
                            <Show when={pts.length > 0}>
                                <path d={pathD} fill="none" stroke={color} stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.9" />
                            </Show>
                            <For each={pts}>
                                {(p) => (
                                    <circle cx={p.x} cy={p.y} r="3.5" fill={color}>
                                        <title>{entry.displayName ?? entry.username}: {p.w.toFixed(1)} kg ({p.date})</title>
                                    </circle>
                                )}
                            </For>
                        </g>
                    );
                }}
            </For>
            <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={VH - PAD.bottom} class="bulk-chart-axis" />
            <line x1={PAD.left} y1={VH - PAD.bottom} x2={VW - PAD.right} y2={VH - PAD.bottom} class="bulk-chart-axis" />
        </svg>
    );
}

// ─── User summary card ─────────────────────────────────────────────────────────

function UserCard(props: { entry: BulkEntry; color: string }) {
    const name = () => props.entry.displayName ?? props.entry.username;
    const initials = () => name().slice(0, 2).toUpperCase();

    const latestDay = () => {
        const d = props.entry.days;
        return d.length > 0 ? d[d.length - 1] : null;
    };
    const latestDate = () => {
        const d = latestDay();
        if (!d) return null;
        return new Date(d.date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const trend = () => {
        const m = props.entry.months;
        if (m.length < 2) return null;
        return m[m.length - 1].avgWeight - m[m.length - 2].avgWeight;
    };
    const trendStr = () => {
        const t = trend();
        if (t == null) return null;
        return `${t > 0 ? '+' : ''}${t.toFixed(1)} kg`;
    };

    return (
        <div class="card bulk-sisters-user-card" style={{ '--user-color': props.color }}>
            <div class="bulk-user-avatar-wrap">
                <Show
                    when={props.entry.profilePicturePath}
                    fallback={
                        <div
                            class="bulk-user-initials"
                            style={{ 'background-color': props.color + '33', color: props.color }}
                        >
                            {initials()}
                        </div>
                    }
                >
                    <img
                        class="bulk-user-avatar"
                        src={`https://jeppenator.com${props.entry.profilePicturePath}`}
                        alt={name()}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                </Show>
            </div>
            <div class="bulk-user-info">
                <span class="bulk-user-name">{name()}</span>
                <Show when={latestDay()}>
                    <span class="bulk-user-weight">{latestDay()!.weightKg.toFixed(1)} kg</span>
                    <span class="muted bulk-user-month">{latestDate()}</span>
                </Show>
                <Show when={trendStr()}>
                    <span class={`bulk-user-trend${(trend() ?? 0) > 0 ? ' bulk-trend-up' : ' bulk-trend-down'}`}>
                        {trendStr()}
                    </span>
                </Show>
            </div>
        </div>
    );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

type Tab = 'days' | 'monthly' | 'recent';

export default function BulkSisters() {
    const [data] = createResource(fetchCommunity);
    const [tab, setTab] = createSignal<Tab>('days');

    return (
        <main class="page">
            <h2 class="page-title">Bulk Sisters 🏋️‍♀️</h2>
            <p class="muted bulk-sisters-tagline">Vikt är makt. Portionssnus ingår ej.</p>

            <Show when={data.loading}>
                <p class="muted" style={{ 'margin-top': '1.5rem' }}>Laddar bulkdata...</p>
            </Show>
            <Show when={data.error}>
                <p class="error-text">Kunde inte hämta data från portionshuset</p>
            </Show>

            <Show when={!data.loading && !data.error && (data()?.length ?? 0) > 0}>
                <div class="bulk-sisters-grid">
                    <For each={data()}>
                        {(entry, i) => (
                            <UserCard entry={entry} color={USER_COLORS[i() % USER_COLORS.length]} />
                        )}
                    </For>
                </div>

                <div class="tab-bar" style={{ 'margin-top': '2rem' }}>
                    <button
                        class={`tab-btn${tab() === 'days' ? ' tab-btn--active' : ''}`}
                        onClick={() => setTab('days')}
                    >
                        Senaste 30 dagarna
                    </button>
                    <button
                        class={`tab-btn${tab() === 'monthly' ? ' tab-btn--active' : ''}`}
                        onClick={() => setTab('monthly')}
                    >
                        Månadsgraf
                    </button>
                    <button
                        class={`tab-btn${tab() === 'recent' ? ' tab-btn--active' : ''}`}
                        onClick={() => setTab('recent')}
                    >
                        Senaste inlägg
                    </button>
                </div>

                <Show when={tab() === 'days'}>
                    <div class="card" style={{ padding: '1.5rem 1rem' }}>
                        <DailyChart data={data()!} />
                        <div class="bulk-sisters-legend">
                            <For each={data()}>
                                {(entry, i) => (
                                    <div class="bulk-legend-item">
                                        <span
                                            class="bulk-legend-dot"
                                            style={{ background: USER_COLORS[i() % USER_COLORS.length] }}
                                        />
                                        <span>{entry.displayName ?? entry.username}</span>
                                    </div>
                                )}
                            </For>
                        </div>
                    </div>
                </Show>

                <Show when={tab() === 'monthly'}>
                    <div class="card" style={{ padding: '1.5rem 1rem' }}>
                        <WeightChart data={data()!} />
                        <div class="bulk-sisters-legend">
                            <For each={data()}>
                                {(entry, i) => (
                                    <div class="bulk-legend-item">
                                        <span
                                            class="bulk-legend-dot"
                                            style={{ background: USER_COLORS[i() % USER_COLORS.length] }}
                                        />
                                        <span>{entry.displayName ?? entry.username}</span>
                                    </div>
                                )}
                            </For>
                        </div>
                    </div>
                </Show>

                <Show when={tab() === 'recent'}>
                    <div class="bulk-recent-grid">
                        <For each={data()}>
                            {(entry, i) => (
                                <div
                                    class="card bulk-recent-card"
                                    style={{ '--user-color': USER_COLORS[i() % USER_COLORS.length] }}
                                >
                                    <div class="bulk-recent-header">
                                        <span
                                            class="bulk-legend-dot"
                                            style={{ background: USER_COLORS[i() % USER_COLORS.length] }}
                                        />
                                        <strong>{entry.displayName ?? entry.username}</strong>
                                    </div>
                                    <Show
                                        when={entry.days.length > 0}
                                        fallback={<p class="muted bulk-recent-empty">Inga inlägg ännu 🫙</p>}
                                    >
                                        <div class="bulk-recent-rows">
                                            <For each={[...entry.days].reverse().slice(0, 7)}>
                                                {(day) => (
                                                    <div class="bulk-recent-row">
                                                        <span class="muted">
                                                            {new Date(day.date).toLocaleDateString('sv-SE', {
                                                                day: 'numeric',
                                                                month: 'short',
                                                            })}
                                                        </span>
                                                        <span class="bulk-recent-weight">{day.weightKg.toFixed(1)} kg</span>
                                                    </div>
                                                )}
                                            </For>
                                        </div>
                                    </Show>
                                </div>
                            )}
                        </For>
                    </div>
                </Show>
            </Show>
        </main>
    );
}
