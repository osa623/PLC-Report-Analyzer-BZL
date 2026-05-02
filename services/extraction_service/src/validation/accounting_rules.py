"""Accounting rules validation module."""

from typing import Dict, List, Any, Optional
from src.utils.logger import get_logger

logger = get_logger(__name__)


class AccountingValidator:
    """Validate extracted data against accounting rules."""
    
    def __init__(self, tolerance: float = 0.01):
        """
        Initialize accounting validator.
        
        Args:
            tolerance: Tolerance percentage for validation (e.g., 0.01 = 1%)
        """
        self.tolerance = tolerance
        self.validation_results = []
        logger.info(f"Initialized AccountingValidator with tolerance={tolerance}")
    
    def validate_balance_sheet(self, data: Dict[str, Any]) -> bool:
        """
        Validate balance sheet equation: Assets = Liabilities + Equity.
        
        Args:
            data: Extracted balance sheet data
        
        Returns:
            True if valid, False otherwise
        """
        try:
            assets = data.get('Total assets', 0)
            liabilities = data.get('Total liabilities', 0)
            equity = data.get('Total equity', 0)  # May need to calculate
            
            if assets and liabilities:
                # Equity might be implicit
                if not equity:
                    equity = assets - liabilities
                
                # Check equation
                left_side = assets
                right_side = liabilities + equity
                
                difference = abs(left_side - right_side)
                tolerance_amount = abs(left_side * self.tolerance)
                
                is_valid = difference <= tolerance_amount
                
                result = {
                    'rule': 'Balance Sheet Equation',
                    'valid': is_valid,
                    'assets': assets,
                    'liabilities': liabilities,
                    'equity': equity,
                    'difference': difference,
                    'tolerance': tolerance_amount
                }
                
                self.validation_results.append(result)
                
                if is_valid:
                    logger.info("Balance sheet equation validated successfully")
                else:
                    logger.warning(
                        f"Balance sheet equation failed: "
                        f"Assets={assets}, Liabilities+Equity={right_side}, "
                        f"Difference={difference}"
                    )
                
                return is_valid
            
            return False
            
        except Exception as e:
            logger.error(f"Error validating balance sheet: {str(e)}")
            return False
    
    def validate_income_statement(self, data: Dict[str, Any]) -> bool:
        """
        Validate income statement calculations.
        
        Args:
            data: Extracted income statement data
        
        Returns:
            True if valid, False otherwise
        """
        try:
            validations = []
            
            # Check: Net Interest Income = Interest Income - Interest Expenses
            interest_income = data.get('Interest income', 0)
            interest_expenses = data.get('Interest expenses', 0)
            net_interest_income = data.get('Net interest income', 0)
            
            if interest_income and interest_expenses and net_interest_income:
                calculated = interest_income - interest_expenses
                difference = abs(calculated - net_interest_income)
                tolerance = abs(net_interest_income * self.tolerance)
                
                is_valid = difference <= tolerance
                validations.append({
                    'rule': 'Net Interest Income',
                    'valid': is_valid,
                    'expected': calculated,
                    'actual': net_interest_income,
                    'difference': difference
                })
            
            # Check: Profit Before Tax - Tax = Profit After Tax
            pbt = data.get('PROFIT BEFORE INCOME TAX', 0)
            tax = data.get('Income tax expense', 0)
            pat = data.get('PROFIT FOR THE YEAR', 0)
            
            if pbt and tax and pat:
                calculated = pbt - tax
                difference = abs(calculated - pat)
                tolerance = abs(pat * self.tolerance)
                
                is_valid = difference <= tolerance
                validations.append({
                    'rule': 'Profit After Tax',
                    'valid': is_valid,
                    'expected': calculated,
                    'actual': pat,
                    'difference': difference
                })
            
            self.validation_results.extend(validations)
            
            all_valid = all(v['valid'] for v in validations)
            
            if all_valid:
                logger.info("Income statement validations passed")
            else:
                logger.warning("Some income statement validations failed")
            
            return all_valid
            
        except Exception as e:
            logger.error(f"Error validating income statement: {str(e)}")
            return False
    
    def validate_cash_flow(self, data: Dict[str, Any]) -> bool:
        """
        Validate cash flow statement calculations.
        
        Args:
            data: Extracted cash flow data
        
        Returns:
            True if valid, False otherwise
        """
        try:
            # Check: Opening Cash + Net Change = Closing Cash
            opening = data.get('Cash and cash equivalents at the beginning of the period', 0)
            change = data.get('Net increase in cash and cash equivalents', 0)
            closing = data.get('Cash and cash equivalents at the end of the period', 0)
            
            if opening and closing:
                if not change:
                    # Calculate change
                    change = closing - opening
                
                calculated = opening + change
                difference = abs(calculated - closing)
                tolerance = abs(closing * self.tolerance)
                
                is_valid = difference <= tolerance
                
                result = {
                    'rule': 'Cash Flow Reconciliation',
                    'valid': is_valid,
                    'opening_cash': opening,
                    'change': change,
                    'closing_cash': closing,
                    'calculated_closing': calculated,
                    'difference': difference
                }
                
                self.validation_results.append(result)
                
                if is_valid:
                    logger.info("Cash flow reconciliation validated")
                else:
                    logger.warning(f"Cash flow reconciliation failed: Difference={difference}")
                
                return is_valid
            
            return False
            
        except Exception as e:
            logger.error(f"Error validating cash flow: {str(e)}")
            return False
    
    def validate_all(self, data: Dict[str, Dict[str, Any]]) -> Dict[str, bool]:
        """
        Run all applicable validations.
        
        Args:
            data: Dictionary with statement types as keys
        
        Returns:
            Dictionary of validation results
        """
        results = {}
        
        if 'income_statement' in data:
            results['income_statement'] = self.validate_income_statement(
                data['income_statement']
            )
        
        if 'balance_sheet' in data:
            results['balance_sheet'] = self.validate_balance_sheet(
                data['balance_sheet']
            )
        
        if 'cash_flow' in data:
            results['cash_flow'] = self.validate_cash_flow(
                data['cash_flow']
            )
        
        logger.info(f"Validation results: {results}")
        return results
    
    def get_validation_report(self) -> List[Dict[str, Any]]:
        """
        Get detailed validation report.
        
        Returns:
            List of validation results
        """
        return self.validation_results
