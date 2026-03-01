import { useEffect, useMemo, useState } from 'react';
import { createApi, getApiError } from '../../services/api';
import {
  type ChainMetadataResponse,
  type TreasuryRebalancePlan,
  type TreasuryRebalancePlanResponse,
  type TransferChain
} from '../../types';

const GOAL_TEMPLATES: Array<{
  id: 'payments' | 'credit' | 'treasury';
  label: string;
  description: string;
  targetChain: TransferChain;
  minUsdc: string;
}> = [
  {
    id: 'payments',
    label: 'Crosschain Payments',
    description: 'Keep Arc Testnet settlement rail funded for fast outbound payments.',
    targetChain: 'arc-testnet',
    minUsdc: '25'
  },
  {
    id: 'credit',
    label: 'Credit Buffer',
    description: 'Maintain Base Sepolia liquidity buffer to support credit-like drawdowns.',
    targetChain: 'base',
    minUsdc: '40'
  },
  {
    id: 'treasury',
    label: 'Treasury Reserve',
    description: 'Top up Ethereum Sepolia reserve for treasury operations and diversification.',
    targetChain: 'ethereum',
    minUsdc: '60'
  }
];

export default function TreasuryRebalanceCard({
  token,
  onExecuted
}: {
  token: string;
  onExecuted: () => Promise<void>;
}) {
  const [targetChain, setTargetChain] = useState<TransferChain>('arc-testnet');
  const [minUsdc, setMinUsdc] = useState('25');
  const [plan, setPlan] = useState<TreasuryRebalancePlan | null>(null);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [metadata, setMetadata] = useState<ChainMetadataResponse | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<'payments' | 'credit' | 'treasury'>('payments');

  const availableChains = useMemo<TransferChain[]>(() => {
    const routable = metadata?.chains?.filter((item) => item.isRoutable).map((item) => item.chain) || [];
    return routable.length ? routable : ['arc-testnet'];
  }, [metadata]);

  useEffect(() => {
    async function fetchMetadata() {
      try {
        const response = await createApi(token).get<ChainMetadataResponse>('/wallet/metadata');
        setMetadata(response.data);

        const routable = response.data.chains.filter((item) => item.isRoutable).map((item) => item.chain);
        if (routable.length && !routable.includes(targetChain)) {
          setTargetChain(routable[0]);
        }
      } catch {
      }
    }

    void fetchMetadata();
  }, [token, targetChain]);

  async function loadPlan() {
    try {
      setIsLoading(true);
      const response = await createApi(token).post<TreasuryRebalancePlanResponse>('/treasury/rebalance/plan', {
        targetChain,
        minUsdc
      });
      setPlan(response.data.plan);
      setMessage(response.data.plan.reason || 'Rebalance plan generated.');
    } catch (error) {
      setPlan(null);
      setMessage(getApiError(error, 'Failed to build rebalance plan'));
    } finally {
      setIsLoading(false);
    }
  }

  function applyTemplate(templateId: 'payments' | 'credit' | 'treasury') {
    const template = GOAL_TEMPLATES.find((item) => item.id === templateId);
    if (!template) {
      return;
    }

    setActiveTemplate(template.id);
    setMinUsdc(template.minUsdc);

    if (availableChains.includes(template.targetChain)) {
      setTargetChain(template.targetChain);
      setMessage(`Template loaded: ${template.label}`);
      return;
    }

    setTargetChain(availableChains[0]);
    setMessage(`${template.label} template loaded. Target chain adjusted to first routable network.`);
  }

  async function executePlan() {
    try {
      setIsLoading(true);
      const response = await createApi(token).post('/treasury/rebalance/execute', {
        targetChain,
        minUsdc
      });

      const routeId = (response.data as { route?: { routeId?: string } }).route?.routeId;
      setMessage(routeId ? `Treasury rebalance submitted (${routeId}).` : 'Treasury rebalance submitted.');
      await onExecuted();
      await loadPlan();
    } catch (error) {
      setMessage(getApiError(error, 'Failed to execute rebalance'));
    } finally {
      setIsLoading(false);
    }
  }

  function getChainLabel(chain: TransferChain) {
    const item = metadata?.chains.find((entry) => entry.chain === chain);
    if (!item) {
      return chain;
    }

    return `${item.label} (${item.chainCode})`;
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
      <h3 className="font-display text-xl font-semibold text-foreground">Treasury Rebalance</h3>
      <p className="mt-2 text-xs text-muted-foreground">
        Maintain minimum USDC on a destination chain using auto-sourced liquidity across configured chains.
      </p>

      <div className="mt-4 grid gap-2 md:grid-cols-3">
        {GOAL_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => applyTemplate(template.id)}
            className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
              activeTemplate === template.id
                ? 'border-blue-500 bg-blue-50 text-blue-800'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <p className="font-semibold">{template.label}</p>
            <p className="mt-1 text-[11px] opacity-90">{template.description}</p>
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-slate-600">Target Chain</label>
          <select
            value={targetChain}
            onChange={(event) => setTargetChain(event.target.value as TransferChain)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-700"
          >
            {availableChains.map((chain) => (
              <option key={chain} value={chain}>
                {getChainLabel(chain)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-600">Minimum USDC on Target</label>
          <input
            value={minUsdc}
            onChange={(event) => setMinUsdc(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-700"
            placeholder="25"
          />
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => void loadPlan()}
          disabled={isLoading}
          className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
        >
          {isLoading ? 'Working...' : 'Generate Plan'}
        </button>
        <button
          type="button"
          onClick={() => void executePlan()}
          disabled={isLoading || !plan?.canExecute}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-blue-600"
        >
          Execute Rebalance
        </button>
      </div>

      {plan && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
          <p><strong>Target:</strong> {getChainLabel(plan.targetChain)}</p>
          <p><strong>Current:</strong> {plan.currentTargetUsdc} USDC</p>
          <p><strong>Minimum:</strong> {plan.minTargetUsdc} USDC</p>
          <p><strong>Deficit:</strong> {plan.deficitUsdc} USDC</p>
          {plan.sourceChain && <p><strong>Source:</strong> {getChainLabel(plan.sourceChain)}</p>}
          {plan.recommendedAmountUsdc && <p><strong>Recommended Move:</strong> {plan.recommendedAmountUsdc} USDC</p>}
          {!plan.canExecute && <p><strong>Note:</strong> {plan.reason}</p>}
        </div>
      )}

      {message && <p className="mt-3 text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}
