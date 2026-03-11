import { ParentComponent, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useAuth } from '../stores/auth';

const ProtectedRoute: ParentComponent = (props) => {
    const [auth] = useAuth();
    const navigate = useNavigate();

    return (
        <Show
            when={!auth.loading}
            fallback={<div class="page" style={{ 'text-align': 'center', 'padding-top': '4rem' }}>Loading...</div>}
        >
            <Show
                when={auth.user}
                fallback={<>{navigate('/login', { replace: true })}</>}
            >
                {props.children}
            </Show>
        </Show>
    );
};

export default ProtectedRoute;
