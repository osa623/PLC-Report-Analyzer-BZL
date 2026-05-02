"""Logging utility for the AI Extractor."""

import logging
import os
from datetime import datetime
from pathlib import Path


def setup_logger(name: str, log_dir: str = "logs", level: str = "INFO") -> logging.Logger:
    """
    Set up a logger with both file and console handlers.
    
    Args:
        name: Name of the logger
        log_dir: Directory to store log files
        level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    
    Returns:
        Configured logger instance
    """
    # Create logs directory if it doesn't exist
    Path(log_dir).mkdir(parents=True, exist_ok=True)
    
    # Create logger
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, level.upper()))
    
    # Avoid adding multiple handlers if logger already exists
    if logger.handlers:
        return logger
    
    # Create formatters
    detailed_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    simple_formatter = logging.Formatter(
        '%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%H:%M:%S'
    )
    
    # File handler - detailed logs
    log_file = os.path.join(log_dir, f"{name}_{datetime.now().strftime('%Y%m%d')}.log")
    file_handler = logging.FileHandler(log_file, encoding='utf-8')
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(detailed_formatter)
    
    # Console handler - simpler logs
    console_handler = logging.StreamHandler()
    console_handler.setLevel(getattr(logging, level.upper()))
    console_handler.setFormatter(simple_formatter)
    
    # Add handlers to logger
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    
    return logger


def get_logger(name: str) -> logging.Logger:
    """
    Get or create a logger with the specified name.
    
    Args:
        name: Name of the logger
    
    Returns:
        Logger instance
    """
    return logging.getLogger(name)
