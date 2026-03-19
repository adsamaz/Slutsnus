import snusIconSrc from '../assets/snusicon.png';

type Props = { size?: number; class?: string };

export function SnusIcon(props: Props) {
    const size = props.size ?? 48;
    return (
        <img
            src={snusIconSrc}
            width={size}
            height={size}
            alt="Snus"
            class={props.class}
            style={{ "border-radius": "50%", "object-fit": "cover" }}
        />
    );
}
