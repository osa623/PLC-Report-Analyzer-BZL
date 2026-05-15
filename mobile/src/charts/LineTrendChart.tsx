import Svg, { Circle, Defs, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { MetricPoint } from '@/types/finance';
import { pointsToPath } from '@/utils/chart';
import { useAppTheme } from '@/store/useThemeStore';

export function LineTrendChart({ points, height = 180 }: { points: MetricPoint[]; height?: number }) {
  const theme = useAppTheme();
  const width = 310;
  const padX = 16;
  const padTop = 10;
  const padBottom = 24;
  const chartH = height - padTop - padBottom;
  const values = points.map((point) => point.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values);

  // Build path manually for more control
  const pts = values.map((v, i) => ({
    x: padX + i * ((width - padX * 2) / Math.max(points.length - 1, 1)),
    y: padTop + chartH - ((v - min * 0.8) / (max - min * 0.8)) * chartH,
  }));

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${pts[pts.length - 1].x} ${padTop + chartH} L ${pts[0].x} ${padTop + chartH} Z`;

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      <Defs>
        <LinearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={theme.gold} stopOpacity="0.25" />
          <Stop offset="0.7" stopColor={theme.gold} stopOpacity="0.04" />
          <Stop offset="1" stopColor={theme.gold} stopOpacity="0" />
        </LinearGradient>
        <LinearGradient id="trendStroke" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={theme.gold} stopOpacity="0.5" />
          <Stop offset="1" stopColor={theme.gold} stopOpacity="1" />
        </LinearGradient>
      </Defs>

      {/* Area fill */}
      <Path d={areaPath} fill="url(#trendFill)" />

      {/* Line */}
      <Path
        d={linePath}
        stroke="url(#trendStroke)"
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Data points */}
      {pts.map((p, i) => (
        <Circle
          key={points[i].year}
          cx={p.x}
          cy={p.y}
          r={3}
          fill={theme.gold}
          stroke={theme.background}
          strokeWidth={1.5}
        />
      ))}

      {/* Year labels */}
      {points.map((point, index) => (
        <SvgText
          key={point.year}
          x={pts[index].x}
          y={height - 6}
          fill={theme.textTertiary}
          fontSize="9"
          fontWeight="400"
          textAnchor="middle"
          letterSpacing={0.3}
        >
          {point.year}
        </SvgText>
      ))}
    </Svg>
  );
}
