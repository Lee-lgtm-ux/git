# 数据格式笔记

先把原始行情数据统一成 CSV，推荐一行代表一个交易日或一个分钟 K 线。

推荐字段：

- `symbol`: 股票代码
- `date`: 日期或时间
- `open`: 开盘价
- `high`: 最高价
- `low`: 最低价
- `close`: 收盘价
- `volume`: 成交量

如果后面数据量很大，可以再升级为 Parquet、SQLite 或 DuckDB。
