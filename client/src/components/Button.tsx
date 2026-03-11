import { JSX, splitProps } from 'solid-js';

interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger';
}

export default function Button(props: ButtonProps) {
    const [local, rest] = splitProps(props, ['variant', 'class', 'children']);
    const variantClass = () => {
        switch (local.variant) {
            case 'secondary': return 'btn btn-secondary';
            case 'danger': return 'btn btn-danger';
            default: return 'btn btn-primary';
        }
    };
    return (
        <button class={`${variantClass()} ${local.class ?? ''}`} {...rest}>
            {local.children}
        </button>
    );
}
