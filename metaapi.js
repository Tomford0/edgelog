// MetaApi (metaapi.cloud) connects to MT4/MT5 accounts. Verify the region URL and
// response shape against your MetaApi dashboard/docs before relying on this in production.
const BASE = () => process.env.METAAPI_URL || 'https://mt-client-api-v1.new-york.agiliumtrade.ai';

export async function fetchClosedTrades(accountId, token, from, to) {
  const url = `${BASE()}/users/current/accounts/${encodeURIComponent(accountId)}/history-deals/time/${from.toISOString()}/${to.toISOString()}`;
  const r = await fetch(url, { headers: { 'auth-token': token } });
  if (!r.ok) throw new Error(`MetaApi responded ${r.status}`);
  const j = await r.json();
  const deals = Array.isArray(j) ? j : j.historyDeals || j.deals || [];
  // A deal that closes a position has entryType DEAL_ENTRY_OUT; its type is the OPPOSITE of the original trade side.
  return deals
    .filter(d => d.entryType === 'DEAL_ENTRY_OUT' && d.symbol)
    .map(d => ({
      externalId: String(d.id),
      trade: {
        date: String(d.time).slice(0, 10),
        symbol: d.symbol.toUpperCase(),
        side: d.type === 'DEAL_TYPE_SELL' ? 'Buy' : 'Sell',
        lots: d.volume ?? 0,
        entry: null,
        exit: d.price ?? null,
        pnl: d.profit ?? 0,
        fees: -((d.commission || 0) + (d.swap || 0)), // costs are negative in MT; we store them positive
        setup: '', emotion: 'Calm', rating: 3, notes: '',
      },
    }));
}
