# 部署指南

## 部署問題及解決方案

### 問題
Vite構建輸出將文件放置在 `dist/public` 目錄中，而Replit靜態部署配置期望文件直接位於 `dist` 目錄中。

### 解決方案
我們提供了兩個解決此問題的文件：

1. `post-build.js` - 一個Node.js腳本，用於將文件從 `dist/public` 移動到 `dist`
2. `build.sh` - 一個shell腳本，運行標準構建然後執行後處理腳本

## 部署步驟

1. 在部署前運行自定義構建腳本：
   ```bash
   ./build.sh
   ```

2. 這將執行標準構建過程，然後自動修復輸出目錄結構。

3. 然後可以正常部署應用程序：
   - 點擊Replit界面中的「Deploy」按鈕
   - Replit將使用 `.replit` 文件中的配置來部署站點

## 注意事項

- 請勿修改 `vite.config.ts` 或 `.replit` 文件，因為這可能會導致環境問題
- 如果部署仍然失敗，請確保構建過程沒有錯誤，並確認 `dist` 目錄中存在 `index.html` 文件