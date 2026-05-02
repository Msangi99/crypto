import { FastifyInstance } from 'fastify';
import { priceService } from '../services/priceService';

const schemas = {
  getAllPrices: {
    tags: ['Prices'],
    summary: 'Get all crypto prices',
    description: 'Returns live BTC, ETH, BNB prices in USD from CoinGecko',
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          prices: {
            type: 'object',
            properties: {
              BTC: {
                type: 'object',
                properties: {
                  usd: { type: 'number' },
                  usd_24h_change: { type: 'number', nullable: true },
                },
              },
              ETH: {
                type: 'object',
                properties: {
                  usd: { type: 'number' },
                  usd_24h_change: { type: 'number', nullable: true },
                },
              },
              BNB: {
                type: 'object',
                properties: {
                  usd: { type: 'number' },
                  usd_24h_change: { type: 'number', nullable: true },
                },
              },
            },
          },
        },
      },
    },
  },
  getCoinPrice: {
    tags: ['Prices'],
    summary: 'Get price for a single coin',
    description: 'Returns the price for a specific coin (BTC, ETH, or BNB)',
    params: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Coin symbol (BTC, ETH, BNB)' },
      },
      required: ['symbol'],
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          symbol: { type: 'string' },
          price: {
            type: 'object',
            properties: {
              usd: { type: 'number' },
              usd_24h_change: { type: 'number', nullable: true },
            },
          },
        },
      },
    },
  },
};

export default async function priceRoutes(fastify: FastifyInstance) {
  // GET /prices — all prices
  fastify.get('/', { schema: schemas.getAllPrices }, async () => {
    const prices = await priceService.getPrices();
    return { success: true, prices };
  });

  // GET /prices/:symbol — single coin
  fastify.get<{ Params: { symbol: string } }>(
    '/:symbol',
    { schema: schemas.getCoinPrice },
    async (request) => {
      const { symbol } = request.params;
      const price = await priceService.getCoinPrice(symbol);
      return { success: true, symbol: symbol.toUpperCase(), price };
    }
  );
}
