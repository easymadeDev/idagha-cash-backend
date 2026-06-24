import { Injectable } from '@nestjs/common';
import { ContributionsService } from '../contributions/contributions.service';
import { ExpensesService } from '../expenses/expenses.service';
import { ReunionFundService } from '../reunion-fund/reunion-fund.service';
import { WalletsService } from '../wallets/wallets.service';
import { PledgesService } from '../pledges/pledges.service';

@Injectable()
export class StatsService {
  constructor(
    private contributionsService: ContributionsService,
    private expensesService: ExpensesService,
    private reunionFundService: ReunionFundService,
    private walletsService: WalletsService,
    private pledgesService: PledgesService,
  ) {}

  async getWalletStats() {
    const wallets = await this.walletsService.findAll();
    const pledgeStats = await this.pledgesService.getStats();

    const results = await Promise.all(
      wallets.map(async (wallet) => {
        const id = (wallet as any)._id.toString();
        const type = (wallet as any).type;

        if (type === 'pledge') {
          return {
            wallet,
            income: pledgeStats.totalFulfilled,
            spent: 0,
            balance: pledgeStats.totalFulfilled,
            pledgeStats,
          };
        }

        const [income, spent] = await Promise.all([
          this.contributionsService.getTotalByWallet(id),
          this.expensesService.getTotalByWallet(id),
        ]);
        return {
          wallet,
          income,
          spent,
          balance: income - spent,
        };
      }),
    );
    return results;
  }

  async getSummary() {
    const [totalContributions, totalExpenses, reunionFund, wallets] = await Promise.all([
      this.contributionsService.getTotal(),
      this.expensesService.getTotal(),
      this.reunionFundService.get(),
      this.getWalletStats(),
    ]);

    const walletBalance = totalContributions - totalExpenses;

    return {
      totalContributions,
      totalExpenses,
      walletBalance,
      availableBalance: walletBalance,
      wallets,
      reunionFund: {
        targetAmount: reunionFund.targetAmount,
        raisedAmount: reunionFund.raisedAmount,
        remaining: Math.max(0, reunionFund.targetAmount - reunionFund.raisedAmount),
        percentage: reunionFund.targetAmount > 0
          ? Math.min(Math.round((reunionFund.raisedAmount / reunionFund.targetAmount) * 100), 100)
          : 0,
      },
    };
  }

  async getMonthlyReport() {
    const contributions = await this.contributionsService.findAll();
    const expenses = await this.expensesService.findAll();

    const monthlyData: Record<string, { contributions: number; expenses: number }> = {};

    contributions.forEach((c) => {
      const key = new Date(c.date).toISOString().slice(0, 7);
      if (!monthlyData[key]) monthlyData[key] = { contributions: 0, expenses: 0 };
      monthlyData[key].contributions += c.amount;
    });

    expenses.forEach((e) => {
      const key = new Date(e.date).toISOString().slice(0, 7);
      if (!monthlyData[key]) monthlyData[key] = { contributions: 0, expenses: 0 };
      monthlyData[key].expenses += e.amount;
    });

    return Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, ...data, net: data.contributions - data.expenses }));
  }
}
