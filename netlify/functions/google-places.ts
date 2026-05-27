import { Handler } from '@netlify/functions';
import fetch from 'node-fetch';

export const handler: Handler = async (event, context) => {
    try {
        const url = event.queryStringParameters?.url;
        
        if (!url) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing url parameter' }),
                headers: {
                    'Access-Control-Allow-Origin': '*',
                }
            };
        }

        const decodedUrl = decodeURIComponent(url);
        const urlObj = new URL(decodedUrl);

        // Add all other query params to the URL
        if (event.queryStringParameters) {
            for (const [key, value] of Object.entries(event.queryStringParameters)) {
                if (key !== 'url' && value) {
                    urlObj.searchParams.append(key, value);
                }
            }
        }

        const response = await fetch(urlObj.toString(), {
            method: event.httpMethod,
            headers: {
                'Accept': 'application/json',
            }
        });

        const data = await response.json();

        return {
            statusCode: 200,
            body: JSON.stringify(data),
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
            }
        };

    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
            headers: {
                'Access-Control-Allow-Origin': '*',
            }
        };
    }
};
