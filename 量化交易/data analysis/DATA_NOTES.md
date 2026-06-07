# Data Analysis 数据说明

本目录从本机项目复制了核心分析代码、网页文件、模型结果和小样例数据。

## 已放入 GitHub 的内容

- Python 构建、训练和验证脚本
- 前端展示文件：`index.html`、`styles.css`、`app.js`
- `scripts/`：按功能归档的 Python 脚本
- `data/frontend/`：前端页面直接加载的内置 JS 数据
- `data/samples/`：小型 CSV 样例
- `results/model outputs/`：模型输出摘要、图表和预测结果
- `results/validation/`：质量信号收益验证结果

## 数据目录结构

```text
data analysis/
├── scripts/
│   ├── data builders/
│   ├── models/
│   ├── validation/
│   └── strategies/
├── data/
│   ├── frontend/
│   └── samples/
├── results/
│   ├── model outputs/
│   └── validation/
├── index.html
├── app.js
└── styles.css
```

## 未放入 GitHub 的内容

完整 `quality_dataset/` 数据集体积约 4.6GB，不适合直接放入普通 GitHub 仓库。

本地原始路径：

```text
/Users/lilongjiang/Desktop/量化交易/data analysis/quality_dataset
```

如需复现实验，请先在本机准备完整数据集，再运行相关构建和训练脚本。
