import { APIGatewayProxyHandler } from 'aws-lambda';

const PRODUCTS = [
    { productId: 'PROD-001', name: 'T-shirt Classique', price: 29.99, stock: 150, category: 'vetements' },
    { productId: 'PROD-002', name: 'Jean Slim', price: 59.99, stock: 80, category: 'vetements' },
    { productId: 'PROD-003', name: 'Veste en Cuir', price: 149.99, stock: 30, category: 'vetements' },
    { productId: 'PROD-004', name: 'Sneakers Blanches', price: 89.99, stock: 60, category: 'chaussures' },
    { productId: 'PROD-005', name: 'Casquette Logo', price: 19.99, stock: 200, category: 'accessoires' },
];

const CORS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
};

export const handler: APIGatewayProxyHandler = async () => ({
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ products: PRODUCTS }),
});
