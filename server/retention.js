const DAY_MS = 24 * 60 * 60 * 1000;

const SETTINGS_KEYS = {
    logsDays: 'retention.logsDays',
    requestsDays: 'retention.requestsDays',
    lastCleanupAt: 'retention.lastCleanupAt'
};

const DEFAULTS = {
    logsDays: 90,
    requestsDays: 180,
    maxDays: 3650,
    minDays: 1,
    scheduleMonths: 1,
    checkIntervalMs: 6 * 60 * 60 * 1000
};

function toUtcIso(date) {
    return date.toISOString();
}

function parseIsoDate(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addUtcMonths(date, months) {
    const source = new Date(date);
    const year = source.getUTCFullYear();
    const month = source.getUTCMonth();
    const day = source.getUTCDate();

    const hours = source.getUTCHours();
    const minutes = source.getUTCMinutes();
    const seconds = source.getUTCSeconds();
    const ms = source.getUTCMilliseconds();

    const firstOfTarget = new Date(Date.UTC(year, month + months, 1, hours, minutes, seconds, ms));
    const lastDayOfTargetMonth = new Date(Date.UTC(firstOfTarget.getUTCFullYear(), firstOfTarget.getUTCMonth() + 1, 0)).getUTCDate();
    firstOfTarget.setUTCDate(Math.min(day, lastDayOfTargetMonth));
    return firstOfTarget;
}

function getSetting(db, key) {
    const row = db.queryOne('SELECT value FROM system_settings WHERE key = ?', [key]);
    return row?.value ?? null;
}

function setSetting(db, key, value, nowIso) {
    db.execute(
        'INSERT OR REPLACE INTO system_settings (key, value, updatedAt) VALUES (?, ?, ?)',
        [key, String(value), nowIso]
    );
}

function parseRetentionDays(value, fallback, label) {
    if (value === undefined || value === null || value === '') return fallback;
    const asNumber = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(asNumber) || !Number.isInteger(asNumber)) {
        throw new Error(`${label} must be an integer`);
    }
    if (asNumber < DEFAULTS.minDays || asNumber > DEFAULTS.maxDays) {
        throw new Error(`${label} must be between ${DEFAULTS.minDays} and ${DEFAULTS.maxDays}`);
    }
    return asNumber;
}

export function getRetentionSettings(db) {
    const logsDaysRaw = getSetting(db, SETTINGS_KEYS.logsDays);
    const requestsDaysRaw = getSetting(db, SETTINGS_KEYS.requestsDays);
    const lastCleanupAtRaw = getSetting(db, SETTINGS_KEYS.lastCleanupAt);

    const logsDays = parseRetentionDays(logsDaysRaw, DEFAULTS.logsDays, 'logsDays');
    const requestsDays = parseRetentionDays(requestsDaysRaw, DEFAULTS.requestsDays, 'requestsDays');

    const lastCleanupDate = parseIsoDate(lastCleanupAtRaw);
    const lastCleanupAt = lastCleanupDate ? toUtcIso(lastCleanupDate) : null;
    const nextCleanupAt = lastCleanupDate ? toUtcIso(addUtcMonths(lastCleanupDate, DEFAULTS.scheduleMonths)) : null;

    return {
        logsDays,
        requestsDays,
        lastCleanupAt,
        nextCleanupAt,
        scheduleMonths: DEFAULTS.scheduleMonths
    };
}

export function updateRetentionSettings(db, updates, now = new Date()) {
    const current = getRetentionSettings(db);
    const nextLogsDays = parseRetentionDays(updates?.logsDays, current.logsDays, 'logsDays');
    const nextRequestsDays = parseRetentionDays(updates?.requestsDays, current.requestsDays, 'requestsDays');

    const nowIso = toUtcIso(now);
    setSetting(db, SETTINGS_KEYS.logsDays, nextLogsDays, nowIso);
    setSetting(db, SETTINGS_KEYS.requestsDays, nextRequestsDays, nowIso);

    return getRetentionSettings(db);
}

export function runRetentionCleanup(db, now = new Date()) {
    const settings = getRetentionSettings(db);
    const nowIso = toUtcIso(now);

    const logsCutoffIso = toUtcIso(new Date(now.getTime() - settings.logsDays * DAY_MS));
    const requestsCutoffIso = toUtcIso(new Date(now.getTime() - settings.requestsDays * DAY_MS));

    const logsToDelete = db.queryOne(
        'SELECT COUNT(*) AS count FROM logs WHERE timestamp < ?',
        [logsCutoffIso]
    )?.count ?? 0;

    const requestsToDelete = db.queryOne(
        "SELECT COUNT(*) AS count FROM requests WHERE status IN ('APPROVED', 'REJECTED') AND createdAt < ?",
        [requestsCutoffIso]
    )?.count ?? 0;

    db.execute('DELETE FROM logs WHERE timestamp < ?', [logsCutoffIso]);
    db.execute("DELETE FROM requests WHERE status IN ('APPROVED', 'REJECTED') AND createdAt < ?", [requestsCutoffIso]);

    setSetting(db, SETTINGS_KEYS.lastCleanupAt, nowIso, nowIso);

    return {
        ...getRetentionSettings(db),
        ranAt: nowIso,
        logsCutoff: logsCutoffIso,
        requestsCutoff: requestsCutoffIso,
        deleted: {
            logs: logsToDelete,
            requests: requestsToDelete
        }
    };
}

export function isRetentionCleanupDue(db, now = new Date()) {
    const settings = getRetentionSettings(db);
    if (!settings.lastCleanupAt) return true;

    const lastCleanup = parseIsoDate(settings.lastCleanupAt);
    if (!lastCleanup) return true;

    const dueAt = addUtcMonths(lastCleanup, DEFAULTS.scheduleMonths);
    return now.getTime() >= dueAt.getTime();
}

export function startRetentionScheduler(db, { checkIntervalMs = DEFAULTS.checkIntervalMs } = {}) {
    const runIfDue = () => {
        try {
            if (!isRetentionCleanupDue(db, new Date())) return;
            const result = runRetentionCleanup(db, new Date());
            console.log('[retention] cleanup completed', {
                ranAt: result.ranAt,
                deleted: result.deleted,
                logsDays: result.logsDays,
                requestsDays: result.requestsDays
            });
        } catch (error) {
            console.error('[retention] cleanup failed', error);
        }
    };

    runIfDue();
    const timer = setInterval(runIfDue, checkIntervalMs);
    timer.unref?.();
    return timer;
}

