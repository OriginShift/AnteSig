# Final visual and comprehension QA

## Conclusion

SINGLE_OPERATOR_QA was executed on 2026-08-09 against exact candidate
`1842769004c044efa9e4414aa1c2df1ca0123629`.

Conclusion: PASS

Findings: P0 `0`, P1 `0`, P2 `0`.

No independent second reviewer is claimed. The maintainer performed the
implementation-separated visual/product QA required by the current
single-operator workflow.

## Candidate and method

- Repository: <https://github.com/OriginShift/AnteSig>
- Exact checkout: `1842769004c044efa9e4414aa1c2df1ca0123629`
- Deployed RC: <https://antesig.vercel.app>
- Node.js: `v22.23.1`
- pnpm: `11.16.0`
- Runtime profile: `CLEAR402_ENABLED=false`

The application was built and served from the exact local checkout. Browser
screenshots were captured from that production build, not from a prior build or
an unrelated URL. Dynamic run IDs were replaced with the stable
`run_redacted-for-stable-qa` marker before capture; no other visible evidence
was changed.

## Fixed viewports

| Viewport | Scenario | Screenshot | Result |
| --- | --- | --- | --- |
| 1440x900 | Happy path | [`visual-1440x900-happy.png`](../artifacts/screenshots/visual-1440x900-happy.png) | PASS |
| 1280x720 | Amount mismatch | [`visual-1280x720-stop.png`](../artifacts/screenshots/visual-1280x720-stop.png) | PASS |
| 390x844 | Happy path | [`visual-390x844-happy.png`](../artifacts/screenshots/visual-390x844-happy.png) | PASS |
| 360x800 | Amount mismatch | [`visual-360x800-stop.png`](../artifacts/screenshots/visual-360x800-stop.png) | PASS |

Each screenshot retains the complete page so reviewers can inspect the first
result viewport and the long-form evidence below it.

## Automated evidence

`pnpm test:e2e --grep 'visual|responsive'` passed against the production server:
8 tests passed and 2 Clear402-enabled-only tests were skipped as required by
the disabled runtime profile. The matched suite covered desktop/mobile happy
and STOP paths, accessible controls, loading stability, disabled-profile
isolation, and explicit Live-failure recovery.

An additional exact-candidate Playwright audit covered all four fixed
viewports. Every viewport reported:

- document width equal to viewport width;
- zero horizontally out-of-bounds visible elements;
- zero clipped buttons, inputs, textareas, or selects;
- zero overlaps between adjacent result sections;
- zero fixed or sticky control occlusions;
- response provenance within the first viewport of the result pane; and
- zero browser console errors and zero uncaught page errors.

## Acceptance review

| Requirement | Result | Evidence |
| --- | --- | --- |
| No overlap, clipping, or horizontal scroll | PASS | DOM geometry audit and four screenshot inspections |
| No text hidden behind fixed controls | PASS | Zero fixed/sticky occlusions |
| Amount mismatch understandable without raw JSON | PASS | Intent and prepared amounts plus critical Alignment failure are visible in the comparison and STOP sections |
| Status is not color-only | PASS | `MANUAL_REVIEW`, `STOP`, `FAIL`, icons, headings, and reason text remain visible |
| Provenance in result and exported evidence boundary | PASS | `Response source FIXTURE` is in the result header; result facts and raw evidence exports retain `FIXTURE` |
| `MANUAL_REVIEW` is not green approval | PASS | Amber presentation explicitly says human review remains required and this is not approval or authorization |
| STOP action boundary is visible | PASS | Red STOP banner shows `DO_NOT_PROCEED_TO_SIGNER` without opening raw JSON |
| Long address, reason, and reference text fits | PASS | 360px audit has no overflow or clipped control and screenshot inspection confirms wrapping |
| Loading, error, and result states are stable | PASS | Responsive suite covered stable loading width, Live error isolation, and explicit Fixture recovery |
| Core result is understandable in 20 seconds | PASS | Maintainer timed comprehension check identified request, prepared capability, observed simulation, provenance, and the final action boundary from the result header and three-way comparison |
| Screenshots belong to exact candidate | PASS | Built and captured from exact checkout; candidate SHA and commands recorded above |

The 20-second check is a bounded maintainer comprehension check, not a claim of
an independent user study. The visible summary supports this reading without
requiring the raw JSON drawers.

## Release impact

No product code or test source was changed during this QA task. No P0/P1 defect
blocks the M5 release-candidate freeze.
