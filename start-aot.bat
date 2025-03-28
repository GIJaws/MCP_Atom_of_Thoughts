@echo off
>nul 2>&1 (
  start "" cmd /c "node D:\Software\MCP\MCP_Atom_of_Thoughts-main\build\index.js"
  timeout /t 2 > nul
  start "" cmd /c "node D:\Software\MCP\MCP_Atom_of_Thoughts-main\build\visualize.js --port=8080"
)