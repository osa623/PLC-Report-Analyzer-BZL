import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useAppTheme } from '@/store/useThemeStore';

type Props = {
  values: number[];
  accent?: 'blue' | 'gold' | 'green' | 'red';
  width?: number;
  height?: number;
};

export function MiniBarChart({ values, accent = 'blue', width = 96, height = 58 }: Props) {
  const theme = useAppTheme();
  const color = accent === 'gold' ? theme.gold : accent === 'green' ? theme.success : accent === 'red' ? theme.danger : theme.royal;
  const max = Math.max(...values, 1);
  const gap = 5;
  const barWidth = (width - gap * (values.length - 1)) / values.length;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={`bar-${accent}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="1" />
          <Stop offset="1" stopColor={color} stopOpacity="0.3" />
        </LinearGradient>
      </Defs>
      {values.map((value, index) => {
        const barHeight = Math.max(4, (value / max) * (height - 4));
        const isLast = index === values.length - 1;
        return (
          <Rect
            key={`${value}-${index}`}
            x={index * (barWidth + gap)}
            y={height - barHeight}
            width={barWidth}
            height={barHeight}
            rx={2.5}
            fill={isLast ? `url(#bar-${accent})` : color}
            opacity={isLast ? 1 : 0.25 + (index / values.length) * 0.45}
          />
        );
      })}
    </Svg>
  );
}
