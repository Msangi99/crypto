import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

// Map our internal coin symbols to their Binance USDT trading pairs.
// USDT is a 1:1 USD-pegged stablecoin so prices effectively equal USD.
// Pairs not in this map will simply be ignored by the WS layer (the
// HTTP fallback in HomeScreen still shows them with their last known value).
const BINANCE_PAIRS: Record<string, string> = {
  BTC: 'btcusdt',
  ETH: 'ethusdt',
  BNB: 'bnbusdt',
  SOL: 'solusdt',
  ADA: 'adausdt',
  DOGE: 'dogeusdt',
  DOT: 'dotusdt',
  AVAX: 'avaxusdt',
  LINK: 'linkusdt',
  UNI: 'uniusdt',
  XRP: 'xrpusdt',
  LTC: 'ltcusdt',
};

export type LivePrice = {
  price: number;
  change24h: number;
  updatedAt: number;
};

/**
 * Subscribes to Binance public 24h ticker streams for the given symbols
 * and returns a live-updated map of { [SYMBOL]: { price, change24h, updatedAt } }.
 *
 * - No auth, no backend hop, no rate limits for ticker streams.
 * - Auto-reconnects with backoff on disconnect.
 * - Pauses the socket when the app is backgrounded and resumes on focus.
 */
export function useLivePrices(symbols: string[]): Record<string, LivePrice> {
  const [prices, setPrices] = useState<Record<string, LivePrice>>({});

  // Stable cache key for the symbol set so we don't tear down the
  // socket on every render of the parent.
  const symbolsKey = useMemo(
    () =>
      Array.from(
        new Set(
          (symbols || [])
            .map((s) => s?.toUpperCase())
            .filter((s): s is string => !!s && !!BINANCE_PAIRS[s])
        )
      )
        .sort()
        .join(','),
    [symbols]
  );

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<any>(null);
  const attemptRef = useRef(0);

  useEffect(() => {
    if (!symbolsKey) return;
    let alive = true;

    const validSymbols = symbolsKey.split(',');
    const streams = validSymbols
      .map((s) => `${BINANCE_PAIRS[s]}@ticker`)
      .join('/');
    const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;

    // Map BINANCE_SYMBOL (uppercase, e.g. "BTCUSDT") -> our symbol ("BTC")
    const reverseMap: Record<string, string> = {};
    validSymbols.forEach((s) => {
      reverseMap[BINANCE_PAIRS[s].toUpperCase()] = s;
    });

    const clearReconnect = () => {
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
    };

    const closeSocket = () => {
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws) {
        try {
          ws.onopen = null as any;
          ws.onmessage = null as any;
          ws.onerror = null as any;
          ws.onclose = null as any;
          ws.close();
        } catch {
          /* ignore */
        }
      }
    };

    const connect = () => {
      if (!alive) return;
      closeSocket();
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        attemptRef.current = 0;
      };

      ws.onmessage = (event: WebSocketMessageEvent) => {
        try {
          const msg = JSON.parse(event.data as string);
          const t = msg?.data;
          if (!t || !t.s) return;
          const sym = reverseMap[String(t.s).toUpperCase()];
          if (!sym) return;
          const price = parseFloat(t.c);
          const change24h = parseFloat(t.P);
          if (!isFinite(price)) return;
          setPrices((prev) => {
            const prior = prev[sym];
            if (
              prior &&
              prior.price === price &&
              prior.change24h === change24h
            ) {
              return prev;
            }
            return {
              ...prev,
              [sym]: {
                price,
                change24h: isFinite(change24h) ? change24h : prior?.change24h ?? 0,
                updatedAt: Date.now(),
              },
            };
          });
        } catch {
          /* ignore malformed payload */
        }
      };

      ws.onerror = () => {
        try { ws.close(); } catch { /* ignore */ }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (!alive) return;
        // Exponential backoff capped at 15s
        const attempt = Math.min(attemptRef.current + 1, 6);
        attemptRef.current = attempt;
        const delay = Math.min(15_000, 500 * 2 ** (attempt - 1));
        clearReconnect();
        reconnectRef.current = setTimeout(connect, delay);
      };
    };

    connect();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          attemptRef.current = 0;
          clearReconnect();
          connect();
        }
      } else {
        clearReconnect();
        closeSocket();
      }
    });

    return () => {
      alive = false;
      clearReconnect();
      closeSocket();
      sub.remove();
    };
  }, [symbolsKey]);

  return prices;
}
