# Coding agent guide

- This repository currently contains exploratory documentation in `docs/brainstorming/`, not an implemented application or approved build specification. Start with its `README.md` and preserve the distinction between accepted, proposed, open, and later decisions.
- Stack: static documentation; no application manifest or package manager yet.
- Build: not configured. Test: not configured. Lint: not configured. Do not invent commands; update this guide when actual project scripts are added.
- CI lives in `.github/workflows/ci.yml` and must stay green. It currently checks out the repository and reports the documentation-only scope; it does not validate application behavior.
- Never commit with `--no-verify`.
- Never commit secrets, local environment files, or `.gg/` agent state.
