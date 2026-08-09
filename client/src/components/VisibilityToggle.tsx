import { For } from 'solid-js';
import type { MushroomVisibility } from '@slutsnus/shared';

const OPTIONS: { value: MushroomVisibility; label: string }[] = [
    { value: 'private', label: '🔒 Privat' },
    { value: 'friends', label: '👥 Vänner' },
    { value: 'public', label: '🌍 Publik' },
];

interface VisibilityToggleProps {
    value: MushroomVisibility;
    onChange: (value: MushroomVisibility) => void;
}

export default function VisibilityToggle(props: VisibilityToggleProps) {
    return (
        <div class="tab-bar">
            <For each={OPTIONS}>
                {(opt) => (
                    <button
                        type="button"
                        class={`tab-btn${props.value === opt.value ? ' tab-btn--active' : ''}`}
                        onClick={() => props.onChange(opt.value)}
                    >
                        {opt.label}
                    </button>
                )}
            </For>
        </div>
    );
}
