# Agent Readme — How to Read This Repo

This repository is **public**. Agents should use:

- **Raw files** (preferred):  
  `https://raw.githubusercontent.com/ComplianceLoop/complianceloop-site/main/<path>`
  - Example: decisions.json  
    https://raw.githubusercontent.com/ComplianceLoop/complianceloop-site/main/decisions.json

- **Folder listings** (JSON):  
  `https://api.github.com/repos/ComplianceLoop/complianceloop-site/contents/<path>?ref=main`
  - Example: providers/score folder  
    https://api.github.com/repos/ComplianceLoop/complianceloop-site/contents/apps/portal/app/api/providers/score?ref=main

No authentication is required for reads. Do not commit secrets; refer to them by name only.
