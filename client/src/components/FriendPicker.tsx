import { For, Show } from 'solid-js';
import type { FriendInfo } from '@slutsnus/shared';

interface FriendPickerProps {
    friends: FriendInfo[];
    selected: string[];
    onToggle: (userId: string) => void;
}

export default function FriendPicker(props: FriendPickerProps) {
    return (
        <div class="svamp-friend-picker">
            <Show
                when={props.friends.length > 0}
                fallback={<p class="muted">Du har inga vänner att dela med än.</p>}
            >
                <p class="muted svamp-friend-picker-label">Visa för:</p>
                <For each={props.friends}>
                    {(friend) => (
                        <label class="svamp-friend-picker-item">
                            <input
                                type="checkbox"
                                checked={props.selected.includes(friend.userId)}
                                onChange={() => props.onToggle(friend.userId)}
                            />
                            {friend.username}
                        </label>
                    )}
                </For>
            </Show>
        </div>
    );
}
