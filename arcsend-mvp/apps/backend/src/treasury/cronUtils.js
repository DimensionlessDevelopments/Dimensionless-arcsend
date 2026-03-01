function parseCronField(field, min, max) {
  const values = new Set();
  const segments = field.split(',').map((part) => part.trim()).filter(Boolean);

  if (!segments.length) {
    throw new Error('CRON_FIELD_EMPTY');
  }

  for (const segment of segments) {
    const [base, stepRaw] = segment.split('/');
    const step = stepRaw ? Number(stepRaw) : 1;

    if (!Number.isInteger(step) || step <= 0) {
      throw new Error('CRON_INVALID_STEP');
    }

    let rangeMin = min;
    let rangeMax = max;

    if (base !== '*') {
      const [startRaw, endRaw] = base.split('-');
      const start = Number(startRaw);
      const end = endRaw !== undefined ? Number(endRaw) : start;

      if (!Number.isInteger(start) || !Number.isInteger(end)) {
        throw new Error('CRON_INVALID_RANGE');
      }

      rangeMin = start;
      rangeMax = end;
    }

    if (rangeMin < min || rangeMax > max || rangeMin > rangeMax) {
      throw new Error('CRON_RANGE_OUT_OF_BOUNDS');
    }

    for (let value = rangeMin; value <= rangeMax; value += step) {
      values.add(value);
    }
  }

  return values;
}

function parseCronExpression(expression) {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error('CRON_MUST_HAVE_5_FIELDS');
  }

  const [minuteField, hourField, dayOfMonthField, monthField, dayOfWeekField] = parts;

  return {
    minutes: parseCronField(minuteField, 0, 59),
    hours: parseCronField(hourField, 0, 23),
    dayOfMonth: parseCronField(dayOfMonthField, 1, 31),
    months: parseCronField(monthField, 1, 12),
    dayOfWeek: parseCronField(dayOfWeekField, 0, 6),
    dayOfMonthWildcard: dayOfMonthField === '*',
    dayOfWeekWildcard: dayOfWeekField === '*'
  };
}

function matchesCron(date, cron) {
  const minute = date.getUTCMinutes();
  const hour = date.getUTCHours();
  const dayOfMonth = date.getUTCDate();
  const month = date.getUTCMonth() + 1;
  const dayOfWeek = date.getUTCDay();

  if (!cron.minutes.has(minute)) return false;
  if (!cron.hours.has(hour)) return false;
  if (!cron.months.has(month)) return false;

  const dayOfMonthMatch = cron.dayOfMonth.has(dayOfMonth);
  const dayOfWeekMatch = cron.dayOfWeek.has(dayOfWeek);

  if (cron.dayOfMonthWildcard && cron.dayOfWeekWildcard) {
    return true;
  }
  if (cron.dayOfMonthWildcard) {
    return dayOfWeekMatch;
  }
  if (cron.dayOfWeekWildcard) {
    return dayOfMonthMatch;
  }

  return dayOfMonthMatch || dayOfWeekMatch;
}

export function validateCronExpression(expression) {
  parseCronExpression(expression);
}

export function computeNextCronRunAt(expression, fromDate = new Date()) {
  const cron = parseCronExpression(expression);
  const candidate = new Date(fromDate);
  candidate.setUTCSeconds(0, 0);
  candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);

  const maxIterations = 60 * 24 * 366;
  for (let i = 0; i < maxIterations; i += 1) {
    if (matchesCron(candidate, cron)) {
      return new Date(candidate);
    }
    candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);
  }

  throw new Error('CRON_NEXT_RUN_NOT_FOUND');
}
