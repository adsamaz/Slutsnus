import { Show, ParentComponent } from 'solid-js';

interface ModalProps {
    open: boolean;
    onClose: () => void;
    title: string;
}

const Modal: ParentComponent<ModalProps> = (props) => {
    return (
        <Show when={props.open}>
            <div class="modal-overlay" onClick={props.onClose}>
                <div class="modal" onClick={(e) => e.stopPropagation()}>
                    <div class="modal-header">
                        <h3>{props.title}</h3>
                        <button class="modal-close" onClick={props.onClose}>✕</button>
                    </div>
                    <div class="modal-body">{props.children}</div>
                </div>
            </div>
        </Show>
    );
};

export default Modal;
