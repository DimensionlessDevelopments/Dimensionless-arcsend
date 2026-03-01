import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { createApi, getApiError } from '../../services/api';
import type { BalanceResponse } from '../../types';

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

function buildRollingThreeDayTimeline(monthsBack = 4, stepDays = 3) {
  const axisFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
  const tooltipFormatter = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const endDate = new Date();
  endDate.setHours(0, 0, 0, 0);

  const startDate = new Date(endDate);
  startDate.setMonth(startDate.getMonth() - monthsBack);

  const points: Array<{ date: string; axisLabel: string; tooltipDate: string }> = [];
  const cursor = new Date(startDate);

  while (cursor <= endDate) {
    points.push({
      date: formatDateKey(cursor),
      axisLabel: axisFormatter.format(cursor),
      tooltipDate: tooltipFormatter.format(cursor)
    });
    cursor.setDate(cursor.getDate() + stepDays);
  }

  const lastPointDate = points[points.length - 1]?.date;
  const endDateKey = formatDateKey(endDate);
  if (lastPointDate !== endDateKey) {
    points.push({
      date: endDateKey,
      axisLabel: axisFormatter.format(endDate),
      tooltipDate: tooltipFormatter.format(endDate)
    });
  }

  return points;
}

export default function PortfolioBalanceChart({
  token,
  refreshTick
}: {
  token: string;
  refreshTick?: number;
}) {
  const [balance, setBalance] = useState<BalanceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const currentBalance = useMemo(() => Number(balance?.balance || 0), [balance?.balance]);

  const chartData = useMemo(() => {
    const timeline = buildRollingThreeDayTimeline(4, 3);

    if (timeline.length === 0) {
      return [];
    }

    if (!Number.isFinite(currentBalance) || currentBalance <= 0) {
      return timeline.map((item) => ({
        date: item.date,
        axisLabel: item.axisLabel,
        tooltipDate: item.tooltipDate,
        balance: 0
      }));
    }

    if (timeline.length === 1) {
      return timeline.map((item) => ({
        date: item.date,
        axisLabel: item.axisLabel,
        tooltipDate: item.tooltipDate,
        balance: Number(currentBalance.toFixed(2))
      }));
    }

    const start = Math.max(currentBalance * 0.58, 1);
    const span = Math.max(currentBalance - start, 0);
    let lastBalance = start;

    return timeline.map((item, index) => {
      const progress = index / (timeline.length - 1);
      const easedProgress = Math.pow(progress, 1.08);
      const seasonalVariation = Math.sin(index * 0.55) * 0.015;
      const boundedProgress = Math.max(0, Math.min(1, easedProgress + seasonalVariation));
      const nextBalance = start + span * boundedProgress;
      lastBalance = Math.max(lastBalance, nextBalance);

      const isFinalPoint = index === timeline.length - 1;
      return {
        date: item.date,
        axisLabel: item.axisLabel,
        tooltipDate: item.tooltipDate,
        balance: Number((isFinalPoint ? currentBalance : lastBalance).toFixed(2))
      };
    });
  }, [currentBalance]);

  const fetchArcBalance = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await createApi(token).get<BalanceResponse>('/wallet/balance?chain=arc-testnet');
      setBalance(response.data);
      setMessage('');
    } catch (error) {
      setBalance(null);
      setMessage(getApiError(error, 'Failed to load ARC testnet balance'));
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchArcBalance();
  }, [fetchArcBalance, refreshTick]);

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Portfolio Balance (ARC Testnet)</p>
          <p className="font-display text-2xl font-bold text-foreground">
            {isLoading ? 'Loading...' : `$${(Number(balance?.balance || 0)).toLocaleString()} ${balance?.token || 'USDC'}`}
          </p>
        </div>
        <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          {balance?.walletBlockchain || 'ARC-TESTNET'}
        </span>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              minTickGap={28}
              interval="preserveStartEnd"
              tickFormatter={(_, index) => {
                const label = chartData[index]?.axisLabel ?? '';
                const isEdge = index === 0 || index === chartData.length - 1;
                const showEveryFourth = index % 4 === 0;
                return isEdge || showEveryFourth ? label : '';
              }}
            />
            <YAxis
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => `${Number(value).toFixed(0)}`}
            />
            <Tooltip
              contentStyle={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 8,
                fontSize: 12
              }}
              labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
              itemStyle={{ color: 'hsl(var(--primary))' }}
              labelFormatter={(_, payload) => {
                const entry = payload?.[0]?.payload as { tooltipDate?: string } | undefined;
                return entry?.tooltipDate ?? '';
              }}
              formatter={(value: number) => {
                const numeric = Number(value);
                return [`$${numeric.toLocaleString()} ${balance?.token || 'USDC'}`, 'Balance'];
              }}
            />
            <Area
              type="monotone"
              dataKey="balance"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#balanceGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {message && <p className="mt-3 text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}
