export type OrderStatus = 'preparation' | 'expedie' | 'livre' | 'annule';

export type ConnectionState = 'connecting' | 'open' | 'reconnecting' | 'closed';

export interface OrderCreatedEvent {
    type: 'OrderCreated';
    orderId: string;
    status: OrderStatus;
    previousStatus: null;
    createdAt: string;
    updatedAt: string;
}

export interface OrderStatusChangedEvent {
    type: 'OrderStatusChanged';
    orderId: string;
    status: OrderStatus;
    previousStatus: OrderStatus;
    createdAt: string;
    updatedAt: string;
}

export type OrderEvent = OrderCreatedEvent | OrderStatusChangedEvent;
