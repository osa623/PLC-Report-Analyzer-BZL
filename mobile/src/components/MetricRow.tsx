import { View } from 'react-native';
import { TText } from '@/components/Themed';
import { RatioMetric } from '@/types/finance';
import { useAppTheme } from '@/store/useThemeStore';

export function MetricRow({ ratio }: { ratio: RatioMetric }) {
  const theme = useAppTheme();
  const changeColor =
    ratio.change.startsWith('+') ? theme.success :
    ratio.change.startsWith('-') ? theme.danger :
    ratio.change === 'Good' ? theme.success :
    theme.textSecondary;

  return (
    <View
      style={{
        marginBottom: 6,
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 10,
        backgroundColor: theme.surfaceInset,
        borderColor: theme.borderLight,
        borderWidth: 0.5,
      }}
    >
      {/* Icon badge */}
      <View
        style={{
          height: 24,
          width: 24,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 6,
          backgroundColor: `${theme.royal}15`,
          borderWidth: 0.5,
          borderColor: `${theme.royal}30`,
        }}
      >
        <TText className="text-[10px] font-bold" style={{ color: theme.royal }}>
          {ratio.label.slice(0, 1)}
        </TText>
      </View>

      {/* Label */}
      <TText className="ml-2 flex-1 text-xs font-normal">{ratio.label}</TText>

      {/* Value */}
      <TText className="mr-3 text-sm font-semibold">{ratio.value}</TText>

      {/* Change */}
      <View
        style={{
          minWidth: 46,
          alignItems: 'flex-end',
        }}
      >
        <TText className="text-[10px] font-medium" style={{ color: changeColor }}>
          {ratio.change}
        </TText>
      </View>
    </View>
  );
}
