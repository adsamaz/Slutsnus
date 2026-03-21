import { Show } from 'solid-js';

interface AvatarProps {
    username: string;
    avatarUrl?: string | null;
    size?: 'sm' | 'md';
}

export default function Avatar(props: AvatarProps) {
    return (
        <div class={`avatar avatar--${props.size ?? 'sm'}`}>
            <Show
                when={props.avatarUrl}
                fallback={<span class="avatar-letter">{props.username.charAt(0).toUpperCase()}</span>}
            >
                <img src={props.avatarUrl!} alt={props.username} class="avatar-img" />
            </Show>
        </div>
    );
}
