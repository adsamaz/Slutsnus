import type { SenusCatcherState, SenusCatcherAction } from '@slutsnus/shared';

interface SenusCatcherGameProps {
    roomCode: string;
    state: SenusCatcherState;
    onAction: (action: SenusCatcherAction) => void;
}

export function SenusCatcherGame(_props: SenusCatcherGameProps) {
    return (
        <div style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'center', height: '100vh', color: '#e6edf3' }}>
            <p>Snus Catcher — laddas...</p>
        </div>
    );
}
