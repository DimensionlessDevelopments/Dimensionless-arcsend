import { runPolicyScheduler } from '../treasury/schedulerService.js';

export async function schedulerRun(req, res) {
  try {
    const result = await runPolicyScheduler({ input: req.body || {} });
    return res.json(result);
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors });
    }

    return res.status(500).json({ error: error.message || 'Failed to run scheduler' });
  }
}
