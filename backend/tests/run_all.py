"""
SSS Corp ERP — Master Test Runner
Runs all test suites sequentially and reports aggregated results.

Run: docker compose exec backend python -m tests.run_all
Requires: Backend running + seed data loaded
"""

import subprocess
import sys
import time


def run_suite(name: str, module: str) -> tuple[bool, float]:
    """Run a test suite and return (success, duration_seconds)."""
    print(f"\n{'='*60}")
    print(f"  Running: {name}")
    print(f"{'='*60}\n")

    start = time.time()
    result = subprocess.run(
        [sys.executable, "-m", module],
        cwd="/app",  # Inside Docker container
    )
    elapsed = time.time() - start

    return result.returncode == 0, elapsed


def main():
    print()
    print("╔" + "═"*58 + "╗")
    print("║   SSS Corp ERP — Full Test Suite Runner                  ║")
    print("╚" + "═"*58 + "╝")

    suites = [
        ("Critical Business Rules (30 tests)", "tests.test_critical_business_rules"),
        ("Workflow & Approval Rules (15 tests)", "tests.test_workflow_rules"),
        ("Go-Live Gate G1-G5 (10 tests)", "tests.test_go_live_gate"),
        ("Go-Live Gate G6-G7 (9 tests)", "tests.test_g6_g7"),
    ]

    results = []
    total_start = time.time()

    for name, module in suites:
        try:
            success, elapsed = run_suite(name, module)
            results.append((name, success, elapsed))
        except Exception as e:
            print(f"  ⚠ Suite failed to run: {e}")
            results.append((name, False, 0))

    total_elapsed = time.time() - total_start

    # Summary
    print()
    print("╔" + "═"*58 + "╗")
    print("║   AGGREGATE RESULTS                                      ║")
    print("╠" + "═"*58 + "╣")

    all_passed = True
    for name, success, elapsed in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"║  {status}  {name:<42} {elapsed:5.1f}s ║")
        if not success:
            all_passed = False

    print("╠" + "═"*58 + "╣")
    overall = "✅ ALL SUITES PASSED" if all_passed else "❌ SOME SUITES FAILED"
    print(f"║  {overall:<48} {total_elapsed:5.1f}s ║")
    print("╚" + "═"*58 + "╝")

    sys.exit(0 if all_passed else 1)


if __name__ == "__main__":
    main()
