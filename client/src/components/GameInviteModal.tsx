import { createSignal, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useFriends } from '../stores/friends';
import { useRoom } from '../stores/room';
import Button from './Button';

export default function GameInviteModal() {
    const [friendsState, friendsActions] = useFriends();
    const [, roomActions] = useRoom();
    const navigate = useNavigate();
    const [accepting, setAccepting] = createSignal(false);

    const handleAccept = async () => {
        const invite = friendsState.pendingInvite;
        if (!invite) return;
        setAccepting(true);
        try {
            friendsActions.acceptInvite(invite.roomCode);
            await roomActions.joinRoom(invite.roomCode);
            navigate(`/lobby/${invite.roomCode}`);
        } finally {
            setAccepting(false);
        }
    };

    return (
        <Show when={friendsState.pendingInvite}>
            {(invite) => (
                <div style={{
                    position: 'fixed',
                    inset: '0',
                    display: 'flex',
                    'align-items': 'center',
                    'justify-content': 'center',
                    background: 'rgba(0,0,0,0.5)',
                    'z-index': '1000',
                }}>
                    <div class="card" style={{ 'max-width': '360px', width: '100%', 'text-align': 'center' }}>
                        <h3 style={{ 'margin-bottom': '0.5rem' }}>Game Invite</h3>
                        <p style={{ 'margin-bottom': '1.25rem' }}>
                            <strong>{invite().fromUsername}</strong> invited you to play <strong>{invite().gameType === 'snusregn' ? 'Snusrain' : invite().gameType}</strong>!
                        </p>
                        <div style={{ display: 'flex', gap: '8px', 'justify-content': 'center' }}>
                            <Button class="btn btn-primary" disabled={accepting()} onClick={handleAccept}>{accepting() ? 'Joining...' : 'Accept'}</Button>
                            <Button class="btn btn-danger" disabled={accepting()} onClick={() => friendsActions.clearInvite()}>Decline</Button>
                        </div>
                    </div>
                </div>
            )}
        </Show>
    );
}
