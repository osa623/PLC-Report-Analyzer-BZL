import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { pointsToPath } from '@/utils/chart';
import { useAppTheme } from '@/store/useThemeStore';

type Props = {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
};

export function Sparkline({ values, color, width = 78, height = 36 }: Props) {
  const theme = useAppTheme();
  const stroke = color || theme.royal;
  const path = pointsToPath(values, width, height, 3);
  const last = values[values.length - 1] || 0;
  const max = Math.max(...values, 1);
  const x = width - 3;
  const y = height - 3 - (last / max) * (height - 6);

  // Area fill path
  const areaPath = `${path} L ${width - 3} ${height - 3} L 3 ${height - 3} Z`;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={`spark-${width}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={stroke} stopOpacity="0.2" />
          <Stop offset="1" stopColor={stroke} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Path d={areaPath} fill={`url(#spark-${width})`} />
      <Path d={path} stroke={stroke} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={x} cy={y} r={2.5} fill={theme.gold} />
    </Svg>
  );
}
