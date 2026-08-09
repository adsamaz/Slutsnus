import { For, Show } from 'solid-js';
import type { MushroomEntryData } from '@slutsnus/shared';

// Validated categorical palette (dataviz skill: OKLab CVD-separation + lightness-band +
// contrast checks all pass against this app's dark surface #0d1117). Assigned by a
// species' fixed position, never by data order, so a color always means the same
// species across renders. Species beyond this palette's 8 slots fall back to
// --color-muted — legend + tooltip labels carry identity for that rare overflow case.
const CHART_SERIES_COLORS = [
    '#3987e5', '#d95926', '#199e70', '#c98500',
    '#d55181', '#008300', '#9085e9', '#e66767',
];
const FALLBACK_SERIES_COLOR = '#8b949e';

const PAD = { left: 50, right: 24, top: 20, bottom: 50 };
const VW = 700, VH = 300;
const chartW = VW - PAD.left - PAD.right;
const chartH = VH - PAD.top - PAD.bottom;

interface Series {
    key: string;
    label: string;
    color: string;
    points: { x: number; y: number; grams: number; date: string }[];
}

function seriesKeyFor(entry: MushroomEntryData): string {
    return entry.speciesId ?? `custom:${entry.customLabel ?? entry.displayLabel}`;
}

function buildSeries(entries: MushroomEntryData[]): { dates: string[]; series: Series[] } {
    const dates = Array.from(new Set(entries.map((e) => e.foundDate))).sort();

    const bySeriesKey = new Map<string, { label: string; color: string; byDate: Map<string, number> }>();
    let colorIndex = 0;
    for (const e of entries) {
        const key = seriesKeyFor(e);
        let s = bySeriesKey.get(key);
        if (!s) {
            const color = colorIndex < CHART_SERIES_COLORS.length
                ? CHART_SERIES_COLORS[colorIndex]
                : FALLBACK_SERIES_COLOR;
            colorIndex += 1;
            s = { label: e.displayLabel, color, byDate: new Map() };
            bySeriesKey.set(key, s);
        }
        s.byDate.set(e.foundDate, (s.byDate.get(e.foundDate) ?? 0) + e.weightGrams);
    }

    const xPos = (idx: number) =>
        PAD.left + (dates.length <= 1 ? chartW / 2 : (idx / (dates.length - 1)) * chartW);

    const series: Series[] = Array.from(bySeriesKey.entries()).map(([key, s]) => ({
        key,
        label: s.label,
        color: s.color,
        points: dates
            .map((date, i) => {
                const grams = s.byDate.get(date);
                if (grams == null) return null;
                return { x: xPos(i), y: 0, grams, date };
            })
            .filter((p): p is NonNullable<typeof p> => p !== null),
    }));

    return { dates, series };
}

export default function SvampAreaChart(props: { entries: MushroomEntryData[] }) {
    const built = () => buildSeries(props.entries);

    const allGrams = () => built().series.flatMap((s) => s.points.map((p) => p.grams));

    const minW = () => {
        const ws = allGrams();
        return ws.length === 0 ? 0 : Math.max(0, Math.floor(Math.min(...ws) - Math.min(...ws) * 0.1));
    };
    const maxW = () => {
        const ws = allGrams();
        return ws.length === 0 ? 500 : Math.ceil(Math.max(...ws) * 1.1);
    };

    const yPos = (grams: number) =>
        PAD.top + chartH - ((grams - minW()) / Math.max(maxW() - minW(), 1)) * chartH;

    const yTicks = () => {
        const min = minW(), max = maxW();
        const step = Math.max(1, Math.ceil((max - min) / 4));
        return Array.from({ length: 5 }, (_, i) => min + i * step);
    };

    const skipEvery = () => Math.max(1, Math.ceil(built().dates.length / 8));

    const formatDate = (d: string) => {
        const [, m, day] = d.split('-');
        return `${day}/${m}`;
    };

    return (
        <Show
            when={props.entries.length > 0}
            fallback={<p class="muted">Inga fynd registrerade i det här området än.</p>}
        >
            <svg viewBox={`0 0 ${VW} ${VH}`} class="bulk-sisters-chart" aria-label="Vikt över tid">
                <For each={yTicks()}>
                    {(tick) => (
                        <>
                            <line x1={PAD.left} y1={yPos(tick)} x2={VW - PAD.right} y2={yPos(tick)} class="bulk-chart-grid" />
                            <text x={PAD.left - 8} y={yPos(tick) + 4} class="bulk-chart-label" text-anchor="end">
                                {tick} g
                            </text>
                        </>
                    )}
                </For>

                <For each={built().dates}>
                    {(date, i) => (
                        <Show when={i() % skipEvery() === 0}>
                            <text
                                x={PAD.left + (built().dates.length <= 1 ? chartW / 2 : (i() / (built().dates.length - 1)) * chartW)}
                                y={VH - PAD.bottom + 18}
                                class="bulk-chart-label"
                                text-anchor="middle"
                            >
                                {formatDate(date)}
                            </text>
                        </Show>
                    )}
                </For>

                <For each={built().series}>
                    {(s) => (
                        <g>
                            <polyline
                                points={s.points.map((p) => `${p.x},${yPos(p.grams)}`).join(' ')}
                                fill="none"
                                stroke={s.color}
                                stroke-width="2.5"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                opacity="0.9"
                            />
                            <For each={s.points}>
                                {(p) => (
                                    <circle cx={p.x} cy={yPos(p.grams)} r="3.5" fill={s.color}>
                                        <title>{s.label}: {p.grams} g ({formatDate(p.date)})</title>
                                    </circle>
                                )}
                            </For>
                        </g>
                    )}
                </For>

                <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={VH - PAD.bottom} class="bulk-chart-axis" />
                <line x1={PAD.left} y1={VH - PAD.bottom} x2={VW - PAD.right} y2={VH - PAD.bottom} class="bulk-chart-axis" />
            </svg>
            <div class="bulk-sisters-legend">
                <For each={built().series}>
                    {(s) => (
                        <div class="bulk-legend-item">
                            <span class="bulk-legend-dot" style={{ background: s.color }} />
                            <span>{s.label}</span>
                        </div>
                    )}
                </For>
            </div>
        </Show>
    );
}
