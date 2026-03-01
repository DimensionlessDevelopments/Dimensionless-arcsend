import { useCallback, useEffect, useMemo, useState } from 'react';
import { createApi, getApiError } from '../../services/api';
import type {
  TreasuryDueRetriesResponse,
  TreasuryRunDetailResponse,
  TreasuryRunsResponse
} from '../../types';

export default function TreasuryAutomationMonitorCard({
  token,
  refreshTick
}: {
  token: string;
  refreshTick?: number;
}) {
  const [runs, setRuns] = useState<TreasuryRunsResponse['items']>([]);
  const [dueRetries, setDueRetries] = useState<TreasuryDueRetriesResponse | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedRunDetail, setSelectedRunDetail] = useState<TreasuryRunDetailResponse | null>(null);
  const [isLoadingRunDetail, setIsLoadingRunDetail] = useState(false);
  const [isRetryingDueItems, setIsRetryingDueItems] = useState(false);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const runStatusSummary = useMemo(() => {
    return runs.reduce(
      (acc, run) => {
        acc[run.status] = (acc[run.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }, [runs]);

  const fetchTelemetry = useCallback(async () => {
    try {
      setIsLoading(true);

      const [runsRes, retriesRes] = await Promise.all([
        createApi(token).get<TreasuryRunsResponse>('/treasury/runs?limit=20'),
        createApi(token).get<TreasuryDueRetriesResponse>('/treasury/items/due-retries?limit=20')
      ]);

      setRuns(runsRes.data.items || []);
      setDueRetries(retriesRes.data);
      if (selectedRunId && !runsRes.data.items?.some((run) => run.id === selectedRunId)) {
        setSelectedRunId(null);
        setSelectedRunDetail(null);
      }
      setMessage('Automation telemetry refreshed.');
    } catch (error) {
      setMessage(getApiError(error, 'Failed to load treasury automation telemetry'));
    } finally {
      setIsLoading(false);
    }
  }, [token, selectedRunId]);

  const fetchRunDetail = useCallback(
    async (runId: string) => {
      try {
        setIsLoadingRunDetail(true);
        setSelectedRunId(runId);

        const response = await createApi(token).get<TreasuryRunDetailResponse>(`/treasury/runs/${runId}`);
        setSelectedRunDetail(response.data);
        setMessage(`Loaded run detail for ${runId}.`);
      } catch (error) {
        setMessage(getApiError(error, 'Failed to load payout run detail'));
      } finally {
        setIsLoadingRunDetail(false);
      }
    },
    [token]
  );

  useEffect(() => {
    void fetchTelemetry();
  }, [fetchTelemetry, refreshTick]);

  const retryDueItemsNow = useCallback(async () => {
    try {
      const items = dueRetries?.items || [];
      if (!items.length) {
        setMessage('No due retry items to process.');
        return;
      }

      const confirmed = window.confirm(
        `Retry ${items.length} due item(s) now? This will execute payout retries immediately.`
      );
      if (!confirmed) {
        setMessage('Retry cancelled.');
        return;
      }

      setIsRetryingDueItems(true);
      const runIds = [...new Set(items.map((item) => item.runId))];

      const results = await Promise.allSettled(
        runIds.map((runId) =>
          createApi(token).post(`/treasury/payouts/${runId}/execute`, {
            retryFailed: true,
            maxItems: 100
          })
        )
      );

      const successful = results.filter((result) => result.status === 'fulfilled').length;
      const failed = results.length - successful;

      await fetchTelemetry();
      if (selectedRunId && runIds.includes(selectedRunId)) {
        await fetchRunDetail(selectedRunId);
      }

      setMessage(`Retry run complete: ${successful} run(s) processed${failed ? `, ${failed} failed` : ''}.`);
    } catch (error) {
      setMessage(getApiError(error, 'Failed to retry due payout items'));
    } finally {
      setIsRetryingDueItems(false);
    }
  }, [dueRetries?.items, fetchRunDetail, fetchTelemetry, selectedRunId, token]);

  const recentRuns = runs.slice(0, 5);
  const dueRetryItems = dueRetries?.items?.slice(0, 5) || [];

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-display text-xl font-semibold text-foreground">Treasury Automation Monitor</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Observe payout runs, status distribution, and retry backlog.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void retryDueItemsNow()}
            disabled={isRetryingDueItems || isLoading || (dueRetries?.count || 0) === 0}
            className="rounded-lg border border-border px-3 py-2 text-xs text-foreground hover:bg-secondary disabled:opacity-50"
          >
            {isRetryingDueItems ? 'Retrying...' : 'Retry Now'}
          </button>
          <button
            type="button"
            onClick={() => void fetchTelemetry()}
            disabled={isLoading}
            className="rounded-lg border border-border px-3 py-2 text-xs text-foreground hover:bg-secondary"
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border/60 bg-secondary/20 px-3 py-2">
          <p className="text-[11px] text-muted-foreground">Tracked Runs</p>
          <p className="text-lg font-semibold text-foreground">{runs.length}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-secondary/20 px-3 py-2">
          <p className="text-[11px] text-muted-foreground">Due Retries</p>
          <p className="text-lg font-semibold text-foreground">{dueRetries?.count || 0}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-secondary/20 px-3 py-2">
          <p className="text-[11px] text-muted-foreground">Generated At</p>
          <p className="text-sm font-medium text-foreground">
            {dueRetries?.generatedAt ? new Date(dueRetries.generatedAt).toLocaleTimeString() : '—'}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {Object.entries(runStatusSummary).map(([status, count]) => (
          <span
            key={status}
            className="rounded-full border border-border px-2.5 py-1 text-xs text-foreground"
          >
            {status}: {count}
          </span>
        ))}
        {!Object.keys(runStatusSummary).length && (
          <span className="text-xs text-muted-foreground">No runs available.</span>
        )}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent Runs</p>
          <ul className="space-y-2">
            {recentRuns.map((run) => (
              <li key={run.id}>
                <button
                  type="button"
                  onClick={() => void fetchRunDetail(run.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-xs ${
                    selectedRunId === run.id
                      ? 'border-foreground/30 bg-secondary/30'
                      : 'border-border/60 hover:bg-secondary/20'
                  }`}
                >
                  <p className="font-medium text-foreground">{run.name || run.id}</p>
                  <p className="text-muted-foreground">
                    {run.status} · {run.totalAmountUsdc} USDC · items {run.itemCount}
                  </p>
                </button>
              </li>
            ))}
            {!recentRuns.length && <li className="text-xs text-muted-foreground">No runs yet.</li>}
          </ul>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Due Retry Items</p>
          <ul className="space-y-2">
            {dueRetryItems.map((item) => (
              <li key={item.id} className="rounded-lg border border-border/60 px-3 py-2 text-xs">
                <p className="font-medium text-foreground">{item.recipientLabel || item.recipientAddress}</p>
                <p className="text-muted-foreground">
                  {item.amountUsdc} USDC · retry {item.retryCount}/{item.maxRetryAttempts}
                </p>
                {item.lastErrorCode && <p className="text-muted-foreground">{item.lastErrorCode}</p>}
              </li>
            ))}
            {!dueRetryItems.length && <li className="text-xs text-muted-foreground">No retry backlog.</li>}
          </ul>
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-border/60 px-3 py-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Run Drill-down</p>
        {isLoadingRunDetail && <p className="text-xs text-muted-foreground">Loading selected run detail...</p>}
        {!isLoadingRunDetail && !selectedRunDetail && (
          <p className="text-xs text-muted-foreground">Select a recent run to view item-level detail.</p>
        )}

        {!isLoadingRunDetail && selectedRunDetail && (
          <div className="space-y-3 text-xs">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-border px-2 py-1 text-foreground">
                Status: {selectedRunDetail.run.status}
              </span>
              <span className="rounded-full border border-border px-2 py-1 text-foreground">
                Total: {selectedRunDetail.run.totalAmountUsdc} USDC
              </span>
              <span className="rounded-full border border-border px-2 py-1 text-foreground">
                Items: {selectedRunDetail.run.itemCount}
              </span>
              <span className="rounded-full border border-border px-2 py-1 text-foreground">
                Due retries: {selectedRunDetail.summary.dueRetryItems}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {Object.entries(selectedRunDetail.summary.statusBreakdown).map(([status, count]) => (
                <span key={status} className="rounded-full border border-border px-2 py-1 text-muted-foreground">
                  {status}: {count}
                </span>
              ))}
            </div>

            <ul className="max-h-52 space-y-2 overflow-y-auto pr-1">
              {selectedRunDetail.run.items.slice(0, 20).map((item) => (
                <li key={item.id} className="rounded border border-border/60 px-2 py-2">
                  <p className="font-medium text-foreground">{item.recipientLabel || item.recipientAddress}</p>
                  <p className="text-muted-foreground">
                    {item.status} · {item.amountUsdc} USDC · retry {item.retryCount}/{item.maxRetryAttempts}
                  </p>
                  {item.lastErrorCode && <p className="text-muted-foreground">{item.lastErrorCode}</p>}
                </li>
              ))}
              {!selectedRunDetail.run.items.length && (
                <li className="text-xs text-muted-foreground">No items in this run.</li>
              )}
            </ul>
          </div>
        )}
      </div>

      {message && <p className="mt-3 text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}
