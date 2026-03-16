from abc import ABC, abstractmethod


class KPIStrategy(ABC):
    @abstractmethod
    def compute(self, financials: dict) -> dict:
        raise NotImplementedError


class BankingKPIStrategy(KPIStrategy):
    def compute(self, financials: dict) -> dict:
        return {"npl_ratio": financials.get("npl_ratio", 0), "capital_adequacy": financials.get("capital_adequacy", 0)}


class ManufacturingKPIStrategy(KPIStrategy):
    def compute(self, financials: dict) -> dict:
        return {"capacity_utilization": financials.get("capacity_utilization", 0), "inventory_turnover": financials.get("inventory_turnover", 0)}


class GenericKPIStrategy(KPIStrategy):
    def compute(self, financials: dict) -> dict:
        return {"roa": financials.get("roa", 0), "roe": financials.get("roe", 0)}
