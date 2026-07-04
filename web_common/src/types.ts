export type OrderStatus = 'preparation' | 'expedie' | 'livre' | 'annule';

export interface Order {
    orderId: string;
    status: OrderStatus;
    createdAt: string;
    updatedAt: string;
}
