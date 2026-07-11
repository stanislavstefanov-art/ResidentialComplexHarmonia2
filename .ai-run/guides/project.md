# Project Context

## Project Identity

| Field | Value | Source |
|---|---|---|
| Project name | Harmonia | `docs/guides/harmonia-product-vision.md` |
| Repository/package | ResidentialComplexHarmonia2 | `git remote -v` |
| Project code/key | none | No ticket system configured |

## Work Item Tracker

| Field | Value |
|---|---|
| Provider | none |
| Key/prefix | none |

> Adapter configuration belongs exclusively in `## Ticket Adapter`. Do not duplicate adapter status or instructions in the Work Item Tracker table.

## Ticket Adapter

**Status**: not configured
**Adapter**: not configured
**Lookup**: not configured
**Create**: not configured
**Output**: not configured

## Source Control And Review

| Field | Value |
|---|---|
| Provider | GitHub |
| Repository remote | git@github.com:stanislavstefanov-art/ResidentialComplexHarmonia2.git |
| Default target branch | master |
| Review artifact type | PR |

## MR Adapter

**Status**: configured
**Adapter**: `gh pr create` via the Bash tool (`gh` CLI authenticated as `stanislavstefanov-art`)
**Instructions**: `gh pr create --base master --head <branch> --title "<title>" --body "<body>"`. Remote is SSH. Run `gh auth status` to verify authentication before use.
