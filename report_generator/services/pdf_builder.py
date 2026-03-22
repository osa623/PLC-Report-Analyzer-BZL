import os
from pathlib import Path
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.graphics.shapes import Drawing, String
from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics.charts.lineplots import LinePlot
from reportlab.graphics.charts.piecharts import Pie
from reportlab.graphics.charts.spider import SpiderChart
from reportlab.graphics.widgets.markers import makeMarker

class PDFBuilder:
    def __init__(self):
        self.styles = getSampleStyleSheet()
        self.title_style = self.styles["Title"]
        self.h1_style = self.styles["Heading1"]
        self.h2_style = self.styles["Heading2"]
        self.body_style = self.styles["Normal"]
        
        self.brand_color = colors.HexColor("#0f172a")
        self.accent_color = colors.HexColor("#3b82f6")
        self.success_color = colors.HexColor("#10b981")
        self.warning_color = colors.HexColor("#f59e0b")
        self.danger_color = colors.HexColor("#ef4444")
        
        self.chart_colors = [
            colors.HexColor("#3b82f6"),
            colors.HexColor("#10b981"),
            colors.HexColor("#f59e0b"),
            colors.HexColor("#ef4444"),
            colors.HexColor("#8b5cf6"),
            colors.HexColor("#ec4899"),
        ]

    def _create_header(self, title: str, subtitle: str = ""):
        elements = []
        elements.append(Paragraph(title, self.title_style))
        if subtitle:
            elements.append(Paragraph(subtitle, self.h2_style))
        elements.append(Spacer(1, 20))
        return elements

    def _create_table(self, data: list[list[str]], col_widths: list[float] | None = None):
        if not data:
            return Spacer(1, 10)
        table = Table(data, colWidths=col_widths)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), self.brand_color),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor("#f8fafc")),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor("#e2e8f0")),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        return table

    def _create_trend_chart(self, trends: list[dict], width=450, height=200):
        drawing = Drawing(width, height)
        chart = LinePlot()
        chart.x = 50
        chart.y = 30
        chart.height = height - 50
        chart.width = width - 100
        
        if not trends:
            return Spacer(1, 10)

        data = []
        names = []
        lines = []
        
        min_year = 9999
        max_year = 0
        min_val = float('inf')
        max_val = float('-inf')

        for idx, t in enumerate(trends):
            pts = []
            vals = t.get("values", [])
            for v in vals:
                yr = int(v["year"])
                val = float(v["value"])
                pts.append((yr, val))
                min_year = min(min_year, yr)
                max_year = max(max_year, yr)
                min_val = min(min_val, val)
                max_val = max(max_val, val)
            
            pts.sort(key=lambda x: x[0])
            data.append(pts)
            names.append(t.get("display_name", t.get("metric_name", "Unknown")))
            lines.append(self.chart_colors[idx % len(self.chart_colors)])

        if not data:
            return Spacer(1, 10)

        chart.data = data
        chart.xValueAxis.valueMin = min_year
        chart.xValueAxis.valueMax = max_year
        chart.xValueAxis.valueStep = 1
        
        chart.yValueAxis.valueMin = min(0, min_val * 1.1)
        chart.yValueAxis.valueMax = max_val * 1.1 if max_val > 0 else 1
        
        for idx in range(len(data)):
            chart.lines[idx].strokeColor = lines[idx]
            chart.lines[idx].strokeWidth = 2
            chart.lines[idx].symbol = makeMarker('FilledCircle')
            chart.lines[idx].symbol.fillColor = lines[idx]

        drawing.add(chart)
        
        # Legend custom
        y_pos = height - 10
        x_pos = 10
        for idx, name in enumerate(names):
            drawing.add(String(x_pos, y_pos, name, fontSize=9, fillColor=lines[idx]))
            x_pos += 100

        return drawing

    def _create_bar_chart(self, title: str, categories: list[str], values: list[float], width=450, height=200):
        drawing = Drawing(width, height)
        chart = VerticalBarChart()
        chart.x = 50
        chart.y = 40
        chart.height = height - 60
        chart.width = width - 100
        
        if not categories or not values:
            return Spacer(1, 10)
        
        chart.data = [values]
        chart.categoryAxis.categoryNames = [str(c) for c in categories]
        chart.categoryAxis.labels.boxAnchor = 'ne'
        chart.categoryAxis.labels.angle = 25
        chart.categoryAxis.labels.dy = -12
        
        min_val = min(values)
        chart.valueAxis.valueMin = min(0, min_val * 1.1)
        max_val = max(values)
        chart.valueAxis.valueMax = max_val * 1.1 if max_val > 0 else 1
        
        chart.bars[0].fillColor = self.accent_color
        
        drawing.add(chart)
        drawing.add(String(10, height - 15, title, fontSize=11))
        return drawing

    def _create_radar_chart(self, ratios: dict, width=300, height=300):
        drawing = Drawing(width, height)
        chart = SpiderChart()
        chart.x = 50
        chart.y = 50
        chart.width = width - 100
        chart.height = height - 100
        
        labels = []
        data = []
        
        for k, v in ratios.items():
            labels.append(k.replace("_", " ").title())
            data.append(float(v))
            
        if not data:
            return Spacer(1, 10)
            
        chart.data = [data]
        chart.labels = labels
        chart.strands[0].fillColor = colors.Color(59/255, 130/255, 246/255, alpha=0.3)
        chart.strands[0].strokeColor = self.accent_color
        
        # dynamic limits based on data max to prevent overflow
        max_v = max(data) if data else 1
        max_v = max(max_v, 1) # avoid 0
        from math import ceil
        
        chart.direction = "clockwise"
        drawing.add(chart)
        return drawing
        
    def _create_pie_chart(self, data_dict: dict, width=300, height=200):
        drawing = Drawing(width, height)
        chart = Pie()
        chart.x = 50
        chart.y = 30
        chart.width = height - 60
        chart.height = height - 60
        
        labels = []
        data = []
        for k, v in data_dict.items():
            if float(v) > 0:
                labels.append(str(k))
                data.append(float(v))
                
        if not data:
            return Spacer(1, 10)
            
        chart.data = data
        chart.labels = labels
        chart.sideLabels = 1
        
        for i in range(len(data)):
            chart.slices[i].fillColor = self.chart_colors[i % len(self.chart_colors)]
            
        drawing.add(chart)
        return drawing

    def _create_heatmap_table(self, heatmap: dict):
        if not heatmap:
            return Spacer(1, 10)
            
        years = set()
        for k, yr_dict in heatmap.items():
            for yr in yr_dict.keys():
                years.add(int(yr))
        years = sorted(list(years))
        
        if not years:
            return Spacer(1, 10)
            
        header = ["Risk Category"] + [str(y) for y in years]
        data = [header]
        
        bg_colors = []
        
        for row_idx, (risk_cat, yr_dict) in enumerate(heatmap.items(), start=1):
            row = [risk_cat.replace("_", " ").title()]
            for col_idx, yr in enumerate(years, start=1):
                conf = float(yr_dict.get(yr, yr_dict.get(str(yr), 0.0)))
                row.append(f"{conf:.2f}")
                
                # heatmap color mapping
                if conf >= 0.8:
                    c = self.danger_color
                elif conf >= 0.5:
                    c = self.warning_color
                elif conf > 0:
                    c = colors.HexColor("#fef08a")
                else:
                    c = colors.HexColor("#f8fafc")
                    
                bg_colors.append(('BACKGROUND', (col_idx, row_idx), (col_idx, row_idx), c))
            data.append(row)
            
        t = Table(data)
        style = [
            ('BACKGROUND', (0, 0), (-1, 0), self.brand_color),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor("#e2e8f0")),
        ] + bg_colors
        t.setStyle(TableStyle(style))
        return t

    def build_comparative_report(self, pdf_path: str, data: dict):
        doc = SimpleDocTemplate(pdf_path, pagesize=A4, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
        elements = []
        
        comp = data.get("company", {})
        title = f"{comp.get('name', 'Company')} Comparative Report"
        years = data.get("years_analyzed", [])
        period = f"{min(years)} - {max(years)}" if years else "Unknown Period"
        
        elements.extend(self._create_header(title, period))
        elements.append(Paragraph(f"Batch ID: {data.get('batch_id')}", self.body_style))
        elements.append(Paragraph(f"Sector: {comp.get('sector', 'N/A')}", self.body_style))
        elements.append(Spacer(1, 20))
        
        # 1. Executive Summary - Financial Health & Investment Signals
        elements.append(Paragraph("Executive Summary", self.h1_style))
        health = data.get("financial_health", {})
        if health:
            elements.append(Paragraph("Financial Health Scores (Out of 100)", self.h2_style))
            health_data = [
                ["Overall", "Profitability", "Liquidity", "Growth", "Efficiency", "Stability"],
                [str(health.get("overall_score", 0)), str(health.get("profitability_score", 0)), 
                 str(health.get("liquidity_score", 0)), str(health.get("growth_score", 0)), 
                 str(health.get("efficiency_score", 0)), str(health.get("stability_score", 0))]
            ]
            elements.append(self._create_table(health_data))
            elements.append(Spacer(1, 20))
            
            # Radar Chart for Health
            ratios_for_radar = {
                "Overall": health.get("overall_score", 0),
                "Profitability": health.get("profitability_score", 0),
                "Liquidity": health.get("liquidity_score", 0),
                "Growth": health.get("growth_score", 0),
                "Efficiency": health.get("efficiency_score", 0),
                "Stability": health.get("stability_score", 0)
            }
            elements.append(self._create_radar_chart(ratios_for_radar))
            elements.append(Spacer(1, 20))
        
        sigs = data.get("investment_signals", [])
        if sigs:
            elements.append(Paragraph("Investment Signals", self.h2_style))
            sig_data = [["Category", "Signal", "Strength", "Description"]]
            for s in sigs:
                sig_data.append([
                    s.get("category", ""), 
                    s.get("signal", ""), 
                    str(s.get("strength", "")), 
                    s.get("description", "")
                ])
            elements.append(self._create_table(sig_data))
            elements.append(PageBreak())

        # 2. Metric Trends (Line Charts)
        elements.append(Paragraph("Metric Trends", self.h1_style))
        trends = data.get("metric_trends", [])
        if trends:
            elements.append(self._create_trend_chart(trends))
            elements.append(Spacer(1, 20))
            
            # Trend Data Table
            t_data = [["Metric", "CAGR", "Latest YoY", "Details"]]
            for t in trends:
                cagr = t.get("cagr")
                yoy = t.get("latest_yoy_change")
                t_data.append([
                    t.get("display_name", ""),
                    f"{cagr*100:.2f}%" if cagr is not None else "N/A",
                    f"{yoy*100:.2f}%" if yoy is not None else "N/A",
                    f"{len(t.get('values', []))} years"
                ])
            elements.append(self._create_table(t_data))
            elements.append(PageBreak())

        # 3. Growth & Cashflow Analysis
        elements.append(Paragraph("Growth & Cashflow Analysis", self.h1_style))
        growth = data.get("growth_analysis", {})
        if growth:
            rev_g = growth.get("revenue_growth_rates", [])
            if rev_g:
                categories = [str(item["year"]) for item in rev_g]
                values = [float(item["value"]) * 100 for item in rev_g]
                elements.append(self._create_bar_chart("Revenue Growth %", categories, values))
                elements.append(Spacer(1, 20))

        cf = data.get("cashflow_breakdown", [])
        if cf:
            elements.append(Paragraph("Cashflow Breakdown", self.h2_style))
            cf_data = [["Year", "Operating", "Investing", "Financing", "Net"]]
            for c in cf:
                cf_data.append([
                    str(c.get("year", "")),
                    f"{c.get('operating') or 0:,.2f}",
                    f"{c.get('investing') or 0:,.2f}",
                    f"{c.get('financing') or 0:,.2f}",
                    f"{c.get('net') or 0:,.2f}"
                ])
            elements.append(self._create_table(cf_data))
            elements.append(PageBreak())

        # 4. DuPont & Ratios
        elements.append(Paragraph("DuPont Analysis", self.h1_style))
        dupont = data.get("dupont_analysis", [])
        if dupont:
            d_data = [["Year", "Net Margin", "Asset Turnover", "Equity Multiplier", "ROE"]]
            for d in dupont:
                d_data.append([
                    str(d.get("year", "")),
                    f"{d.get('net_margin') or 0:.4f}",
                    f"{d.get('asset_turnover') or 0:.4f}",
                    f"{d.get('equity_multiplier') or 0:.4f}",
                    f"{d.get('roe') or 0:.4f}",
                ])
            elements.append(self._create_table(d_data))
            elements.append(Spacer(1, 20))
            
        # 5. Risk Landscape
        elements.append(Paragraph("Risk Landscape Heatmap", self.h1_style))
        heatmap = data.get("risk_heatmap", {})
        if heatmap:
            elements.append(self._create_heatmap_table(heatmap))
        else:
            elements.append(Paragraph("No significant risks detected.", self.body_style))

        doc.build(elements)
        return pdf_path

    def build_single_report(self, pdf_path: str, data: dict):
        doc = SimpleDocTemplate(pdf_path, pagesize=A4, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
        elements = []
        
        report_id = data.get("report_id", "Unknown")
        elements.extend(self._create_header("Financial Document Analysis", f"Report ID: {report_id}"))
        
        # 1. Summary
        elements.append(Paragraph("Summary Metrics", self.h1_style))
        summary = data.get("summary", {})
        if summary:
            s_data = [["Metric", "Value"]]
            for k, v in summary.items():
                s_data.append([k.replace("_", " ").title(), f"{v:,.2f}" if v else "N/A"])
            elements.append(self._create_table(s_data))
            
            categories = []
            values = []
            for k, v in summary.items():
                if isinstance(v, (int, float)):
                    categories.append(k.replace("_", " ").title())
                    values.append(float(v))
            if values:
                elements.append(self._create_bar_chart("Primary Metrics Overview", categories, values))
            elements.append(Spacer(1, 20))
            
        # 2. Ratios Radar if available
        ratios = data.get("ratios", {})
        flat_ratios = {}
        target_metrics = ["gross_margin", "net_margin", "current_ratio", "return_on_equity", "debt_to_equity"]
        for cat, items in ratios.items():
            if isinstance(items, dict):
                for k, v in items.items():
                     if k in target_metrics and v.get("value") is not None:
                         flat_ratios[k] = v["value"]
        
        if len(flat_ratios) >= 3:
            elements.append(Paragraph("Key Financial Ratios", self.h1_style))
            elements.append(self._create_radar_chart(flat_ratios))
            elements.append(Spacer(1, 20))

        # 3. Segments
        segments = data.get("segment_analysis", [])
        if segments:
            elements.append(Paragraph("Segment Division", self.h1_style))
            seg_dict = {}
            for s in segments:
                val = s.get("value")
                if isinstance(val, (int, float)) and s.get("segment_name"):
                    seg_dict[s["segment_name"]] = val
            if seg_dict:
                elements.append(self._create_pie_chart(seg_dict))
                elements.append(Spacer(1, 20))

        # 4. Patterns & Risk Flags
        patterns = data.get("patterns", [])
        if patterns:
             elements.append(Paragraph("Detected Patterns", self.h1_style))
             p_data = [["Type", "Confidence", "Description"]]
             for p in patterns:
                 p_data.append([
                     p.get("pattern_type", ""),
                     f"{p.get('confidence', 0):.2f}",
                     Paragraph(p.get("description", ""), self.body_style)
                 ])
             elements.append(self._create_table(p_data, col_widths=[100, 70, 330]))
             elements.append(Spacer(1, 20))
             
        risk_flags = data.get("risk_flags", [])
        if risk_flags:
             elements.append(Paragraph("Risk Flags", self.h1_style))
             r_data = [["Type", "Confidence", "Description"]]
             for r in risk_flags:
                 r_data.append([
                     r.get("flag_type", ""),
                     f"{r.get('confidence', 0):.2f}",
                     Paragraph(r.get("description", ""), self.body_style)
                 ])
             elements.append(self._create_table(r_data, col_widths=[100, 70, 330]))
             elements.append(Spacer(1, 20))
             
        doc.build(elements)
        return pdf_path
