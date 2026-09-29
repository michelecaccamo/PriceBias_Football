"""Non-parametric checks: bootstrap intervals and permutation tests."""

import numpy as np
import pandas as pd


def bootstrap_median(values: pd.Series, n_boot: int = 2000, seed: int = 0) -> dict:
    """Median with a 95% percentile bootstrap interval."""
    x = values.dropna().to_numpy()
    if len(x) == 0:
        return {"median": None, "ci_low": None, "ci_high": None, "n": 0}
    rng = np.random.default_rng(seed)
    meds = np.median(rng.choice(x, size=(n_boot, len(x)), replace=True), axis=1)
    lo, hi = np.percentile(meds, [2.5, 97.5])
    return {"median": float(np.median(x)), "ci_low": float(lo), "ci_high": float(hi), "n": len(x)}


def permutation_test(a: pd.Series, b: pd.Series, n_perm: int = 10000, seed: int = 0) -> dict:
    """Two-sided test of mean(a) - mean(b) by shuffling group labels."""
    a, b = a.dropna().to_numpy(), b.dropna().to_numpy()
    if len(a) < 3 or len(b) < 3:
        return {"diff": None, "p_value": None, "n_a": len(a), "n_b": len(b)}
    observed = a.mean() - b.mean()
    pooled = np.concatenate([a, b])
    rng = np.random.default_rng(seed)
    count = 0
    for _ in range(n_perm):
        rng.shuffle(pooled)
        if abs(pooled[: len(a)].mean() - pooled[len(a):].mean()) >= abs(observed):
            count += 1
    return {
        "diff": float(observed),
        "p_value": (count + 1) / (n_perm + 1),
        "n_a": len(a),
        "n_b": len(b),
    }
