import {
  getGlobalTurnover,
  getOutstandingBalances,
  getRecentPayments,
  getTopClients,
  getTurnoverByCategory,
} from './financeService';

export async function getReportingSnapshot() {
  const [global, byCategory, topClients, recentPayments, outstanding] = await Promise.all([
    getGlobalTurnover(),
    getTurnoverByCategory(),
    getTopClients(10),
    getRecentPayments(10),
    getOutstandingBalances(10),
  ]);

  return { global, byCategory, topClients, recentPayments, outstanding };
}
