from services.kpi_strategies import BankingKPIStrategy, GenericKPIStrategy, ManufacturingKPIStrategy, KPIStrategy


class KPIStrategyFactory:
    _strategy_map = {
        "banking": BankingKPIStrategy,
        "manufacturing": ManufacturingKPIStrategy,
    }

    @classmethod
    def create(cls, sector: str) -> KPIStrategy:
        strategy_cls = cls._strategy_map.get(sector.lower(), GenericKPIStrategy)
        return strategy_cls()
