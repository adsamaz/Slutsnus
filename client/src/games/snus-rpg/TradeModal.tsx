import Button from '../../components/Button';
import type { TradeOffer } from '@slutsnus/shared';

interface TradeModalProps {
    offer: TradeOffer;
    fromUsername: string;
    onAccept: () => void;
    onDecline: () => void;
}

export default function TradeModal(props: TradeModalProps) {
    return (
        <div class="modal-overlay trade-overlay">
            <div class="modal trade-modal">
                <h3>Trade Offer!</h3>
                <p class="trade-from">
                    <strong>{props.fromUsername}</strong> wants to trade with you
                </p>
                <div class="trade-items">
                    <div class="trade-item">
                        <span class="trade-label">Offered brand</span>
                        <span class="trade-brand">{props.offer.displayedName}</span>
                        <Button class="btn btn-danger" onClick={props.onDecline}>Decline</Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
