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

        self.title_style.fontName = "Helvetica-Bold"
        self.title_style.fontSize = 24
        self.title_style.leading = 28
        self.title_style.textColor = self.brand_color

        self.h1_style.fontName = "Helvetica-Bold"
        self.h1_style.fontSize = 16
        self.h1_style.leading = 20
        self.h1_style.textColor = self.brand_color
        self.h1_style.spaceBefore = 6
        self.h1_style.spaceAfter = 8

        self.h2_style.fontName = "Helvetica-Bold"
        self.h2_style.fontSize = 12
        self.h2_style.leading = 15
        self.h2_style.textColor = self.brand_color
        self.h2_style.spaceBefore = 4
        self.h2_style.spaceAfter = 6

        self.body_style.fontSize = 10
        self.body_style.leading = 14

        self.meta_style = ParagraphStyle(
            "MetaStyle",
            parent=self.body_style,
            textColor=colors.HexColor("#334155"),
            fontSize=9,
            leading=12,
        )
        self.section_kicker_style = ParagraphStyle(
            "SectionKicker",
            parent=self.body_style,
            textColor=colors.HexColor("#1d4ed8"),
            fontSize=9,
            leading=12,
            fontName="Helvetica-Bold",
        )

    @staticmethod
    def _format_number(value: Any) -> str:
        if value is None:
            return "N/A"
        if isinstance(value, (int, float)):
            return f"{float(value):,.2f}"
        return str(value)

    @staticmethod
    def _format_percent(value: Any) -> str:
        if value is None:
            return "N/A"
        if isinstance(value, (int, float)):
            return f"{float(value) * 100:.2f}%"
        return str(value)

    @staticmethod
    def _safe_float(value: Any) -> float | None:
        try:
            if value is None:
                return None
            return float(value)
        except (TypeError, ValueError):
            return None

    def _create_section_header(self, title: str, subtitle: str = ""):
        header_table = Table(
            [[Paragraph(title, self.h1_style)]],
            colWidths=[515],
            hAlign="LEFT",
        )
        header_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#e2e8f0")),
            ("LEFTPADDING", (0, 0), (-1, -1), 12),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("LINEBELOW", (0, 0), (-1, -1), 1, colors.HexColor("#94a3b8")),
        ]))

        elements = [header_table]
        if subtitle:
            elements.append(Spacer(1, 4))
            elements.append(Paragraph(subtitle, self.meta_style))
        elements.append(Spacer(1, 10))
        return elements

    def _prepare_metric_matrix(self, trends: list[dict[str, Any]]) -> tuple[list[int], dict[str, dict[int, float]]]:
        metrics_by_name: dict[str, dict[int, float]] = {}
        years: set[int] = set()

        for trend in trends:
            metric_name = str(trend.get("display_name") or trend.get("metric_name") or "Unknown")
            points = trend.get("values") if isinstance(trend.get("values"), list) else []
            metric_points: dict[int, float] = {}
            for point in points:
                if not isinstance(point, dict):
                    continue
                year = point.get("year")
                value = self._safe_float(point.get("value"))
                if isinstance(year, int) and value is not None:
                    metric_points[year] = value
                    years.add(year)
            if metric_points:
                metrics_by_name[metric_name] = metric_points

        return sorted(years), metrics_by_name

    def _create_signal_table(self, signals: list[dict[str, Any]]):
        signal_rows = [["Category", "Signal", "Strength", "Analyst Interpretation"]]
        for signal in signals:
            signal_label = str(signal.get("signal") or "").upper()
            strength_value = self._safe_float(signal.get("strength"))
            signal_rows.append([
                str(signal.get("category") or ""),
                signal_label,
                f"{strength_value:.2f}" if strength_value is not None else "N/A",
                str(signal.get("description") or ""),
            ])

        table = self._create_table(signal_rows, col_widths=[120, 80, 70, 245])
        if isinstance(table, Spacer):
            return table

        highlight_styles = []
        for row_idx, signal in enumerate(signals, start=1):
            signal_label = str(signal.get("signal") or "").upper()
            if signal_label == "BULLISH":
                highlight_styles.append(("BACKGROUND", (1, row_idx), (1, row_idx), colors.HexColor("#dcfce7")))
            elif signal_label == "BEARISH":
                highlight_styles.append(("BACKGROUND", (1, row_idx), (1, row_idx), colors.HexColor("#fee2e2")))
            else:
                highlight_styles.append(("BACKGROUND", (1, row_idx), (1, row_idx), colors.HexColor("#fef9c3")))

        table.setStyle(TableStyle(highlight_styles))
        return table

    def _create_header(self, title: str, subtitle: str = ""):
        elements = []
        elements.append(Paragraph(title, self.title_style))
        if subtitle:
            elements.append(Paragraph(subtitle, self.h2_style))
        elements.append(Spacer(1, 20))
        return elements

    def _create_banner(self, title: str, subtitle: str = ""):
        title_paragraph = Paragraph(
            f"<font color='#f8fafc'><b>{title}</b></font>",
            ParagraphStyle(
                "BannerTitle",
                parent=self.h1_style,
                textColor=colors.HexColor("#f8fafc"),
                fontSize=18,
                leading=22,
            ),
        )
        rows = [[title_paragraph]]
        if subtitle:
            subtitle_paragraph = Paragraph(
                f"<font color='#cbd5e1'>{subtitle}</font>",
                ParagraphStyle(
                    "BannerSubtitle",
                    parent=self.body_style,
                    textColor=colors.HexColor("#cbd5e1"),
                    fontSize=10,
                    leading=14,
                ),
            )
            rows.append([subtitle_paragraph])

        banner = Table(rows, colWidths=[515], hAlign="LEFT")
        banner.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#0b1324")),
            ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#1d4ed8")),
            ("LEFTPADDING", (0, 0), (-1, -1), 14),
            ("RIGHTPADDING", (0, 0), (-1, -1), 14),
            ("TOPPADDING", (0, 0), (-1, -1), 10),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ]))
        return [banner, Spacer(1, 12)]

    def _create_bullet_list(self, items: list[str], style: ParagraphStyle | None = None):
        elements = []
        if not items:
            return [Paragraph("No highlights available for current data.", self.body_style)]

        bullet_style = style or self.body_style
        for item in items:
            elements.append(Paragraph(f"• {str(item)}", bullet_style))
            elements.append(Spacer(1, 3))
        return elements

    def _create_score_tiles(self, score_pairs: list[tuple[str, Any]]):
        if not score_pairs:
            return Spacer(1, 8)

        score_rows = []
        row: list[Paragraph] = []
        for idx, (label, value) in enumerate(score_pairs, start=1):
            value_text = "N/A"
            if isinstance(value, (int, float)):
                value_text = f"{float(value):.1f}"
            tile = Paragraph(
                f"<font size='9' color='#334155'>{label}</font><br/><font size='16' color='#0f172a'><b>{value_text}</b></font>",
                self.body_style,
            )
            row.append(tile)
            if idx % 3 == 0:
                score_rows.append(row)
                row = []

        if row:
            while len(row) < 3:
                row.append(Paragraph("", self.body_style))
            score_rows.append(row)

        table = Table(score_rows, colWidths=[170, 170, 170], hAlign="LEFT")
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f1f5f9")),
            ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#cbd5e1")),
            ("INNERGRID", (0, 0), (-1, -1), 1, colors.HexColor("#e2e8f0")),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        return table

    def _build_comparative_key_findings(self, data: dict[str, Any]) -> list[str]:
        findings: list[str] = []

        quality_gate = data.get("quality_gate", {}) if isinstance(data.get("quality_gate"), dict) else {}
        coverage = quality_gate.get("coverage")
        if isinstance(coverage, (int, float)):
            findings.append(f"Data coverage across uploaded reports is {coverage * 100:.1f}%.")

        health = data.get("financial_health", {}) if isinstance(data.get("financial_health"), dict) else {}
        overall = self._safe_float(health.get("overall_score"))
        if overall is not None:
            if overall >= 75:
                band = "strong"
            elif overall >= 55:
                band = "moderate"
            else:
                band = "fragile"
            findings.append(f"Overall financial health score is {overall:.1f}/100, indicating a {band} profile.")

        trends = data.get("metric_trends", []) if isinstance(data.get("metric_trends"), list) else []
        for trend in trends:
            if not isinstance(trend, dict):
                continue
            metric = str(trend.get("display_name") or trend.get("metric_name") or "Metric")
            yoy = self._safe_float(trend.get("latest_yoy_change"))
            cagr = self._safe_float(trend.get("cagr"))
            if yoy is not None:
                direction = "increased" if yoy >= 0 else "declined"
                findings.append(f"{metric} {direction} {abs(yoy) * 100:.1f}% in the latest year.")
            elif cagr is not None:
                findings.append(f"{metric} CAGR over the observed horizon is {cagr * 100:.1f}%.")
            if len(findings) >= 6:
                break

        signals = data.get("investment_signals", []) if isinstance(data.get("investment_signals"), list) else []
        bullish = 0
        bearish = 0
        for signal in signals:
            if not isinstance(signal, dict):
                continue
            label = str(signal.get("signal") or "").upper()
            if label == "BULLISH":
                bullish += 1
            elif label == "BEARISH":
                bearish += 1
        if bullish or bearish:
            findings.append(f"Signal mix: {bullish} bullish and {bearish} bearish indicators.")

        return findings[:8]

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
        elements.extend(self._create_banner("Evidence-Based Comparative Analysis", "Strictly document-derived metrics with explicit integrity and validation diagnostics."))
        elements.append(Paragraph("STRICT FORENSIC ANALYTICS DOSSIER", self.section_kicker_style))
        elements.append(Spacer(1, 4))
        elements.append(Paragraph(f"Batch ID: {data.get('batch_id')}", self.meta_style))
        elements.append(Paragraph(f"Sector: {comp.get('sector', 'N/A')}", self.meta_style))
        elements.append(Paragraph(f"Status: {str(data.get('status', 'unknown')).upper()}", self.meta_style))
        years_in_scope = data.get("years_analyzed", []) if isinstance(data.get("years_analyzed"), list) else []
        if years_in_scope:
            elements.append(Paragraph(f"Years Included: {', '.join([str(y) for y in sorted(years_in_scope)])}", self.meta_style))

        requested_report_ids = data.get("requested_report_ids", []) if isinstance(data.get("requested_report_ids"), list) else []
        eligible_report_ids = data.get("report_ids", []) if isinstance(data.get("report_ids"), list) else []
        skipped_report_ids = data.get("skipped_report_ids", []) if isinstance(data.get("skipped_report_ids"), list) else []
        data_integrity = data.get("data_integrity", {}) if isinstance(data.get("data_integrity"), dict) else {}
        coverage_pct = data_integrity.get("coverage_percent")

        def fmt_number_or_dna(value: Any) -> str:
            if isinstance(value, (int, float)):
                return self._format_number(value)
            return "DATA NOT AVAILABLE"

        def fmt_percent_or_dna(value: Any) -> str:
            if isinstance(value, (int, float)):
                return f"{float(value) * 100:.2f}%"
            return "DATA NOT AVAILABLE"

        scope_data = [["Requested Reports", "Eligible Reports", "Skipped", "Coverage"]]
        scope_data.append([
            str(len(requested_report_ids) if requested_report_ids else len(data.get("report_snapshots", []))),
            str(len(eligible_report_ids)),
            str(len(skipped_report_ids)),
            f"{float(coverage_pct):.2f}%" if isinstance(coverage_pct, (int, float)) else "DATA NOT AVAILABLE",
        ])
        elements.append(Spacer(1, 12))
        elements.append(self._create_table(scope_data, col_widths=[130, 130, 90, 110]))
        elements.append(Spacer(1, 16))

        snapshots = data.get("report_snapshots", [])
        if snapshots:
            elements.extend(self._create_section_header("Report-Level Coverage Snapshot", "Validation view of each uploaded report to confirm none were silently ignored."))
            snap_table = [["Report ID", "Revenue", "Net Profit", "Operating CF", "Assets", "Ratios", "Patterns"]]
            for snapshot in snapshots:
                summary = snapshot.get("summary") or {}
                revenue = summary.get("total_revenue")
                net_profit = summary.get("net_profit")
                operating_cf = summary.get("operating_cashflow")
                total_assets = summary.get("total_assets")

                snap_table.append([
                    str(snapshot.get("report_id", ""))[:12] + "...",
                    fmt_number_or_dna(revenue),
                    fmt_number_or_dna(net_profit),
                    fmt_number_or_dna(operating_cf),
                    fmt_number_or_dna(total_assets),
                    str(snapshot.get("ratio_count", 0)),
                    str(snapshot.get("pattern_count", 0)),
                ])
            elements.append(self._create_table(snap_table, col_widths=[95, 70, 70, 70, 70, 55, 55]))
            elements.append(Spacer(1, 16))

        report_readiness = data.get("report_readiness", [])
        if isinstance(report_readiness, list) and report_readiness:
            readiness_rows = [["Report ID", "Ready", "Readiness Notes"]]
            for item in report_readiness:
                if not isinstance(item, dict):
                    continue
                report_id = str(item.get("report_id", ""))
                ready = bool(item.get("ready"))
                reasons = item.get("reasons") if isinstance(item.get("reasons"), list) else []
                reason_text = "None" if not reasons else ", ".join([str(reason) for reason in reasons])
                readiness_rows.append([report_id[:16] + "...", "YES" if ready else "NO", reason_text])

            if len(readiness_rows) > 1:
                elements.append(Paragraph("Data Readiness by Uploaded Report", self.h2_style))
                readiness_table = self._create_table(readiness_rows, col_widths=[110, 55, 350])
                if isinstance(readiness_table, Table):
                    readiness_styles = []
                    for idx, item in enumerate(report_readiness, start=1):
                        if isinstance(item, dict) and bool(item.get("ready")):
                            readiness_styles.append(("BACKGROUND", (1, idx), (1, idx), colors.HexColor("#dcfce7")))
                        else:
                            readiness_styles.append(("BACKGROUND", (1, idx), (1, idx), colors.HexColor("#fee2e2")))
                    readiness_table.setStyle(TableStyle(readiness_styles))
                elements.append(readiness_table)
                elements.append(Spacer(1, 16))

        elements.extend(self._create_section_header("A. Verified Financial Summary", "Year-wise values strictly from extracted documents; missing entries are marked as DATA NOT AVAILABLE."))
        verified_summary = data.get("verified_financial_summary", []) if isinstance(data.get("verified_financial_summary"), list) else []
        summary_rows = [["Year", "Revenue", "Net Profit", "Total Assets", "Total Equity", "Operating CF"]]
        for item in verified_summary:
            if not isinstance(item, dict):
                continue
            summary_rows.append([
                str(item.get("year") or ""),
                fmt_number_or_dna(item.get("revenue")),
                fmt_number_or_dna(item.get("net_profit")),
                fmt_number_or_dna(item.get("total_assets")),
                fmt_number_or_dna(item.get("total_equity")),
                fmt_number_or_dna(item.get("operating_cashflow")),
            ])
        if len(summary_rows) > 1:
            elements.append(self._create_table(summary_rows, col_widths=[60, 90, 90, 90, 90, 95]))
        else:
            elements.append(Paragraph("DATA NOT AVAILABLE", self.body_style))

        metric_trends = data.get("metric_trends", []) if isinstance(data.get("metric_trends"), list) else []
        chart_trends: list[dict[str, Any]] = []
        target_metric_order = ["revenue", "net_profit", "total_assets", "total_equity"]
        metric_by_name = {}
        for trend in metric_trends:
            if isinstance(trend, dict):
                metric_by_name[str(trend.get("metric_name") or "")] = trend
        for metric_name in target_metric_order:
            trend = metric_by_name.get(metric_name)
            if isinstance(trend, dict) and isinstance(trend.get("values"), list) and trend.get("values"):
                chart_trends.append(trend)
        if chart_trends:
            elements.append(Spacer(1, 10))
            elements.append(Paragraph("Core Financial Trend Chart", self.h2_style))
            elements.append(self._create_trend_chart(chart_trends[:4]))

        ratio_comparison = data.get("ratio_comparison", {})
        if isinstance(ratio_comparison, dict) and ratio_comparison:
            elements.append(Spacer(1, 10))
            elements.append(Paragraph("Key Ratios (Only Where Inputs Were Available)", self.h2_style))
            ratio_rows = [["Ratio", "Year", "Value"]]
            for ratio_name, points in sorted(ratio_comparison.items()):
                if not isinstance(points, list):
                    continue
                for point in points:
                    if isinstance(point, dict):
                        ratio_rows.append([
                            str(ratio_name).replace("_", " ").title(),
                            str(point.get("year") or ""),
                            fmt_number_or_dna(point.get("value")),
                        ])
            if len(ratio_rows) > 1:
                elements.append(self._create_table(ratio_rows, col_widths=[220, 95, 200]))

        elements.append(PageBreak())

        elements.extend(self._create_section_header("B. Growth Analysis", "Computed only where prior-year and current-year values are both present."))
        growth = data.get("growth_analysis", {})
        if growth:
            growth_rows = [["Growth Metric", "Year", "Rate"]]
            for name, series in (
                ("Revenue", growth.get("revenue_growth_rates", [])),
                ("Profit", growth.get("profit_growth_rates", [])),
                ("Asset", growth.get("asset_growth_rates", [])),
                ("Margin", growth.get("margin_trends", [])),
            ):
                if not isinstance(series, list):
                    continue
                for item in series:
                    if isinstance(item, dict):
                        growth_value = item.get("value")
                        direction = "Increase" if isinstance(growth_value, (int, float)) and float(growth_value) >= 0 else "Decrease"
                        growth_rows.append([
                            name,
                            str(item.get("year", "")),
                            fmt_percent_or_dna(growth_value) + (f" ({direction})" if isinstance(growth_value, (int, float)) else ""),
                        ])
            if len(growth_rows) > 1:
                elements.append(self._create_table(growth_rows, col_widths=[110, 90, 315]))
            else:
                elements.append(Paragraph("DATA NOT AVAILABLE", self.body_style))

            rev_growth = growth.get("revenue_growth_rates", []) if isinstance(growth.get("revenue_growth_rates"), list) else []
            if rev_growth:
                growth_categories = []
                growth_values = []
                for point in rev_growth:
                    if isinstance(point, dict) and isinstance(point.get("value"), (int, float)):
                        growth_categories.append(str(point.get("year") or ""))
                        growth_values.append(float(point.get("value")) * 100)
                if growth_values:
                    elements.append(Spacer(1, 8))
                    elements.append(self._create_bar_chart("Revenue YoY Growth (%)", growth_categories, growth_values))

        elements.append(Spacer(1, 12))
        cf = data.get("cashflow_breakdown", [])
        if isinstance(cf, list) and cf:
            elements.append(Paragraph("Cashflow Movement", self.h2_style))
            cf_data = [["Year", "Operating", "Investing", "Financing", "Net"]]
            for c in cf:
                if isinstance(c, dict):
                    cf_data.append([
                        str(c.get("year", "")),
                        fmt_number_or_dna(c.get("operating")),
                        fmt_number_or_dna(c.get("investing")),
                        fmt_number_or_dna(c.get("financing")),
                        fmt_number_or_dna(c.get("net")),
                    ])
            if len(cf_data) > 1:
                elements.append(self._create_table(cf_data, col_widths=[70, 110, 110, 110, 115]))
            else:
                elements.append(Paragraph("DATA NOT AVAILABLE", self.body_style))

        elements.append(PageBreak())

        elements.extend(self._create_section_header("C. Risk and Stability Indicators", "Capital and liquidity indicators computed only when required fields exist."))
        risk_rows = [["Year", "Debt/Equity", "Equity/Assets", "Current Ratio", "NPL Ratio", "Stage 3 Ratio"]]
        risk_stability = data.get("risk_stability_indicators", []) if isinstance(data.get("risk_stability_indicators"), list) else []
        for item in risk_stability:
            if not isinstance(item, dict):
                continue
            risk_rows.append([
                str(item.get("year") or ""),
                fmt_number_or_dna(item.get("debt_to_equity")),
                fmt_number_or_dna(item.get("equity_to_assets")),
                fmt_number_or_dna(item.get("current_ratio")),
                fmt_number_or_dna(item.get("npl_ratio")),
                fmt_number_or_dna(item.get("stage_3_ratio")),
            ])
        if len(risk_rows) > 1:
            elements.append(self._create_table(risk_rows, col_widths=[60, 90, 90, 90, 90, 95]))
        else:
            elements.append(Paragraph("DATA NOT AVAILABLE", self.body_style))

        current_ratio_categories = []
        current_ratio_values = []
        for item in risk_stability:
            if isinstance(item, dict) and isinstance(item.get("current_ratio"), (int, float)):
                current_ratio_categories.append(str(item.get("year") or ""))
                current_ratio_values.append(float(item.get("current_ratio")))
        if current_ratio_values:
            elements.append(Spacer(1, 8))
            elements.append(self._create_bar_chart("Current Ratio by Year", current_ratio_categories, current_ratio_values))

        elements.append(Spacer(1, 14))
        elements.extend(self._create_section_header("D. Data Integrity Report", "Missing fields, conflicts, and coverage computed from usable extracted values only."))
        integrity_rows = [["Integrity Metric", "Value"]]
        integrity_rows.append(["Coverage", f"{float(coverage_pct):.2f}%" if isinstance(coverage_pct, (int, float)) else "DATA NOT AVAILABLE"])
        integrity_rows.append(["Requested Reports", str(data_integrity.get("requested_reports", len(requested_report_ids)))])
        integrity_rows.append(["Eligible Reports", str(data_integrity.get("eligible_reports", len(eligible_report_ids)))])
        integrity_rows.append(["Years Covered", ", ".join([str(y) for y in data_integrity.get("years_covered", [])]) if data_integrity.get("years_covered") else "DATA NOT AVAILABLE"])
        elements.append(self._create_table(integrity_rows, col_widths=[180, 335]))

        missing_fields = data_integrity.get("missing_fields", []) if isinstance(data_integrity.get("missing_fields"), list) else []
        elements.append(Spacer(1, 10))
        elements.append(Paragraph("Missing Fields", self.h2_style))
        if missing_fields:
            missing_rows = [["Year", "Metric", "Status"]]
            for item in missing_fields[:40]:
                if isinstance(item, dict):
                    missing_rows.append([
                        str(item.get("year") or ""),
                        str(item.get("metric") or "").replace("_", " ").title(),
                        "DATA NOT AVAILABLE",
                    ])
            elements.append(self._create_table(missing_rows, col_widths=[80, 240, 195]))
        else:
            elements.append(Paragraph("No missing required fields detected.", self.body_style))

        conflicts = data_integrity.get("conflicting_values", []) if isinstance(data_integrity.get("conflicting_values"), list) else []
        elements.append(Spacer(1, 10))
        elements.append(Paragraph("Conflicting Values", self.h2_style))
        if conflicts:
            conflict_rows = [["Year", "Metric", "Selected Source", "Selected Value", "Candidate Values"]]
            for conflict in conflicts[:25]:
                if isinstance(conflict, dict):
                    candidates = conflict.get("candidate_values")
                    candidate_text = ", ".join([self._format_number(v) for v in candidates]) if isinstance(candidates, list) else ""
                    conflict_rows.append([
                        str(conflict.get("year") or ""),
                        str(conflict.get("metric") or "").replace("_", " ").title(),
                        str(conflict.get("selected_source") or "unknown"),
                        fmt_number_or_dna(conflict.get("selected_value")),
                        candidate_text or "DATA NOT AVAILABLE",
                    ])
            elements.append(self._create_table(conflict_rows, col_widths=[55, 120, 95, 95, 150]))
        else:
            elements.append(Paragraph("No conflicts detected for resolved metrics.", self.body_style))

        elements.append(PageBreak())
        elements.extend(self._create_section_header("E. Analyst Commentary", "Maximum six evidence-backed statements; any uncertain statement is excluded."))
        commentary = data.get("analyst_commentary", []) if isinstance(data.get("analyst_commentary"), list) else []
        if commentary:
            elements.extend(self._create_bullet_list([str(item) for item in commentary[:6]], self.body_style))
        else:
            elements.append(Paragraph("DATA NOT AVAILABLE", self.body_style))

        elements.append(Spacer(1, 16))
        elements.append(Paragraph("End of Analytical Report", self.meta_style))

        doc.build(elements)
        return pdf_path

    def build_single_report(self, pdf_path: str, data: dict):
        doc = SimpleDocTemplate(pdf_path, pagesize=A4, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
        elements = []
        
        report_id = data.get("report_id", "Unknown")
        elements.extend(self._create_header("Financial Document Analysis", f"Report ID: {report_id}"))
        elements.extend(self._create_banner("Single-Report Forensic Analysis", "Statement coverage, ratio interpretation, and extraction quality diagnostics."))
        
        # 1. Summary
        elements.extend(self._create_section_header("Executive Overview", "Primary extracted metrics with a quick visual profile."))
        elements.append(Paragraph("Summary Metrics", self.h2_style))
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

        metric_trends = data.get("metric_trends", {})
        if isinstance(metric_trends, dict) and metric_trends:
            elements.append(Paragraph("Metric Trends Across Extracted Years", self.h2_style))
            trend_rows = [["Metric", "Years Captured", "Latest Value", "Trend Span"]]
            for metric, series in sorted(metric_trends.items()):
                if not isinstance(series, dict) or not series:
                    continue
                years = sorted([year for year in series.keys() if isinstance(year, int)])
                if not years:
                    continue
                latest_year = years[-1]
                earliest_year = years[0]
                latest_value = series.get(latest_year)
                trend_rows.append([
                    str(metric).replace("_", " ").title(),
                    str(len(years)),
                    self._format_number(latest_value),
                    f"{earliest_year} to {latest_year}",
                ])
            if len(trend_rows) > 1:
                elements.append(self._create_table(trend_rows, col_widths=[170, 90, 125, 130]))
                elements.append(Spacer(1, 14))
            
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
            elements.extend(self._create_section_header("Ratio Lens", "Core ratios used to gauge profitability, liquidity, and leverage."))
            elements.append(Paragraph("Key Financial Ratios", self.h2_style))
            elements.append(self._create_radar_chart(flat_ratios))
            elements.append(Spacer(1, 20))

        # 3. Segments
        segments = data.get("segment_analysis", [])
        if segments:
            elements.extend(self._create_section_header("Segment Composition", "Distribution of extracted segment-level values for the latest captured year."))
            elements.append(Paragraph("Segment Division", self.h2_style))
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
            elements.extend(self._create_section_header("Pattern Intelligence", "High-confidence pattern detections and associated analyst cues."))
            elements.append(Paragraph("Detected Patterns", self.h2_style))
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
            elements.append(Paragraph("Risk Flags", self.h2_style))
            r_data = [["Type", "Confidence", "Description"]]
            for r in risk_flags:
                r_data.append([
                    r.get("flag_type", ""),
                    f"{r.get('confidence', 0):.2f}",
                    Paragraph(r.get("description", ""), self.body_style)
                ])
            elements.append(self._create_table(r_data, col_widths=[100, 70, 330]))
            elements.append(Spacer(1, 20))

        top_line_items = data.get("top_line_items", [])
        if isinstance(top_line_items, list) and top_line_items:
            elements.extend(self._create_section_header("Material Line Items", "Largest extracted values to help validate statement coverage and scale."))
            line_rows = [["Year", "Entity", "Semantic Type", "Label", "Value"]]
            for item in top_line_items[:15]:
                if not isinstance(item, dict):
                    continue
                line_rows.append([
                    str(item.get("year") or ""),
                    str(item.get("entity_type") or ""),
                    str(item.get("semantic_type") or ""),
                    str(item.get("label") or "")[:34],
                    self._format_number(item.get("value")),
                ])
            if len(line_rows) > 1:
                elements.append(self._create_table(line_rows, col_widths=[55, 70, 120, 170, 100]))
                elements.append(Spacer(1, 14))

        semantic_distribution = data.get("semantic_distribution", [])
        if isinstance(semantic_distribution, list) and semantic_distribution:
            elements.append(Paragraph("Semantic Distribution", self.h2_style))
            semantic_rows = [["Semantic Type", "Count"]]
            for item in semantic_distribution:
                if isinstance(item, dict):
                    semantic_rows.append([
                        str(item.get("semantic_type") or "unknown").replace("_", " ").title(),
                        str(item.get("count") or 0),
                    ])
            if len(semantic_rows) > 1:
                elements.append(self._create_table(semantic_rows, col_widths=[380, 135]))
                elements.append(Spacer(1, 14))

        narrative_consistency = data.get("narrative_consistency", [])
        if isinstance(narrative_consistency, list) and narrative_consistency:
            elements.append(Paragraph("Narrative Consistency Checks", self.h2_style))
            consistency_rows = [["Type", "Confidence", "Description"]]
            for item in narrative_consistency:
                if isinstance(item, dict):
                    consistency_rows.append([
                        str(item.get("type") or ""),
                        f"{float(item.get('confidence')):.2f}" if isinstance(item.get("confidence"), (int, float)) else "N/A",
                        Paragraph(str(item.get("description") or ""), self.body_style),
                    ])
            if len(consistency_rows) > 1:
                elements.append(self._create_table(consistency_rows, col_widths=[110, 70, 335]))
                elements.append(Spacer(1, 14))

        extraction_overview = data.get("extraction_overview", [])
        if isinstance(extraction_overview, list) and extraction_overview:
            elements.extend(self._create_section_header("Extraction Appendix", "Evidence lines and parser diagnostics for QA and traceability."))
            elements.append(Paragraph("Extraction Overview", self.h2_style))
            elements.extend(self._create_bullet_list([str(line) for line in extraction_overview[:18]], self.meta_style))
            elements.append(Spacer(1, 10))

        elements.append(Paragraph("End of Analytical Report", self.meta_style))
             
        doc.build(elements)
        return pdf_path
