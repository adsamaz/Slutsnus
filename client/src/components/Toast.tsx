import { createSignal, For } from 'solid-js';

interface Toast {
    id: number;
    message: string;
    type: 'info' | 'success' | 'error';
}

const [toasts, setToasts] = createSignal<Toast[]>([]);
let nextId = 0;

export function showToast(message: string, type: 'info' | 'success' | 'error' = 'info', duration = 4000) {
    const id = ++nextId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
}

export function ToastContainer() {
    return (
        <div class="toast-container">
            <For each={toasts()}>
                {(toast) => (
                    <div class={`toast toast-${toast.type}`}>
                        {toast.message}
                        <button
                            class="toast-close"
                            onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                        >
                            ✕
                        </button>
                    </div>
                )}
            </For>
        </div>
    );
}
