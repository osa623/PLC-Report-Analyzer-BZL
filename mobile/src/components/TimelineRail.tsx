import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { TText } from '@/components/Themed';
import { useAppTheme } from '@/store/useThemeStore';

export function TimelineRail({ years, activeYear = '2025' }: { years: string[]; activeYear?: string }) {
  const theme = useAppTheme();
  const [selected, setSelected] = useState(activeYear);

  return (
    <View
      style={{
        marginTop: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 10,
        padding: 4,
        backgroundColor: theme.surfaceInset,
        borderColor: theme.borderLight,
        borderWidth: 0.5,
      }}
    >
      {years.map((year) => {
        const active = year === selected;
        return (
          <Pressable
            key={year}
            onPress={() => setSelected(year)}
            style={{
              flex: 1,
              borderRadius: 8,
              paddingVertical: 8,
              alignItems: 'center',
              backgroundColor: active ? `${theme.gold}18` : 'transparent',
            }}
          >
            <TText
              className="text-xs font-medium"
              style={{ color: active ? theme.gold : theme.textTertiary }}
            >
              {year}
            </TText>
          </Pressable>
        );
      })}
    </View>
  );
}
