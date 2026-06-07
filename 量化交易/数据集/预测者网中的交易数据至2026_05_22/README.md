# 预测者网中的交易数据至2026_05_22

这个目录用于记录本地数据集的位置和结构。原始数据体积较大，不直接提交到 GitHub。

## 本地原始路径

```text
/Users/lilongjiang/Desktop/量化交易/trading-data.20260522
```

## 数据规模

- 文件数量：约 6163 个
- 总体积：约 4.2GB
- 指数数据：约 33MB
- 股票数据：约 4.1GB

## 原始结构

```text
trading-data.20260522/
├── index data/
├── stock data/
└── readme.txt
```

## GitHub 中的样例数据

为了方便查看数据格式，本目录保留了一小部分样例数据：

```text
sample data/
├── index data/
│   ├── sh000001.csv
│   ├── sh000300.csv
│   └── sz399001.csv
├── stock data/
│   ├── sh600000.csv
│   ├── sh600519.csv
│   ├── sz000001.csv
│   ├── sz000333.csv
│   └── sz300750.csv
└── 原始数据readme.txt
```

## GitHub 存放策略

这个数据集不直接放入普通 GitHub 仓库，原因是数据体积过大，会导致 push、clone、pull 都很慢，也可能触发 GitHub 的文件大小限制。

当前 GitHub 仓库只保存数据说明、代码和小样例数据。完整数据保留在本机原始路径中。
