type ApiGatewayResponse = {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
};

const handler = async (): Promise<ApiGatewayResponse> => {
    return {
        statusCode: 200,
        headers: {
            "content-type": "application/json",
        },
        body: JSON.stringify({
            message: "GetOrdersFunction operationnelle",
            timestamp: new Date().toISOString(),
        }),
    };
};

export { handler };