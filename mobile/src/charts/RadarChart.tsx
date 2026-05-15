import Svg, { Circle, Defs, Line, LinearGradient, Polygon, Stop, Text as SvgText } from 'react-native-svg';
import { useAppTheme } from '@/store/useThemeStore';
import { polarToCartesian } from '@/utils/chart';

const labels = [
  ['ROE', '21.3%'],
  ['ROA', '13.8%'],
  ['Operating', '18.9%'],
  ['Net Margin', '16.1%'],
  ['FCF Quality', '0.92'],
  ['EBITDA', '24.7%'],
];

export function RadarChart({ size = 240 }: { size?: number }) {
  const theme = useAppTheme();
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.28;
  const values = [0.78, 0.68, 0.58, 0.72, 0.62, 0.75];
  const goldValues = [0.95, 0.86, 0.82, 0.88, 0.88, 0.9];

  const polygon = (scaleValues: number[]) =>
    scaleValues
      .map((value, index) => {
        const angle = (360 / labels.length) * index;
        const point = polarToCartesian(cx, cy, radius * value, angle);
        return `${point.x},${point.y}`;
      })
      .join(' ');

  return (
    <Svg width={size} height={size}>
      <Defs>
        <LinearGradient id="radarFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={theme.royal} stopOpacity="0.3" />
          <Stop offset="1" stopColor={theme.royal} stopOpacity="0.05" />
        </LinearGradient>
      </Defs>

      {/* Grid rings */}
      {[0.25, 0.5, 0.75, 1].map((level) => (
        <Polygon
          key={level}
          points={polygon(Array(labels.length).fill(level))}
          fill="none"
          stroke={theme.chartGrid}
          strokeWidth={0.5}
          opacity={0.6}
        />
      ))}

      {/* Axis lines */}
      {labels.map((label, index) => {
        const angle = (360 / labels.length) * index;
        const outer = polarToCartesian(cx, cy, radius * 1.05, angle);
        return (
          <Line
            key={label[0]}
            x1={cx}
            y1={cy}
            x2={outer.x}
            y2={outer.y}
            stroke={theme.chartGrid}
            strokeWidth={0.5}
            opacity={0.5}
          />
        );
      })}

      {/* Gold reference polygon */}
      <Polygon
        points={polygon(goldValues)}
        fill={theme.gold}
        fillOpacity={0.06}
        stroke={theme.gold}
        strokeWidth={1}
        opacity={0.6}
      />

      {/* Blue data polygon */}
      <Polygon
        points={polygon(values)}
        fill="url(#radarFill)"
        stroke={theme.royal}
        strokeWidth={1.8}
      />

      {/* Data points */}
      {values.map((value, index) => {
        const point = polarToCartesian(cx, cy, radius * value, (360 / labels.length) * index);
        return (
          <Circle
            key={index}
            cx={point.x}
            cy={point.y}
            r={3}
            fill={theme.white}
            stroke={theme.royal}
            strokeWidth={1.2}
          />
        );
      })}

      {/* Labels */}
      {labels.map((label, index) => {
        const angle = (360 / labels.length) * index;
        const namePoint = polarToCartesian(cx, cy, radius * 1.42, angle);
        const valPoint = polarToCartesian(cx, cy, radius * 1.62, angle);
        return (
          <SvgText
            key={label[0]}
            x={namePoint.x}
            y={namePoint.y}
            textAnchor="middle"
            fill={theme.textSecondary}
            fontSize="8"
            fontWeight="500"
            letterSpacing={0.3}
          >
            {label[0]}
          </SvgText>
        );
      })}

      {/* Values below labels */}
      {labels.map((label, index) => {
        const angle = (360 / labels.length) * index;
        const valPoint = polarToCartesian(cx, cy, radius * 1.62, angle);
        return (
          <SvgText
            key={`v-${label[0]}`}
            x={valPoint.x}
            y={valPoint.y}
            textAnchor="middle"
            fill={theme.text}
            fontSize="9"
            fontWeight="700"
          >
            {label[1]}
          </SvgText>
        );
      })}
    </Svg>
  );
}
