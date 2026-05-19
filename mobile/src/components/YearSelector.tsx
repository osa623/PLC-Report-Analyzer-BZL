import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { TText } from '@/components/Themed';
import { useAppTheme } from '@/store/useThemeStore';

export function YearSelector({ years, activeYear = '2025' }: { years: string[]; activeYear?: string }) {
  const theme = useAppTheme();
  const [selected, setSelected] = useState(activeYear);

  return (
    <View
      style={{
        marginBottom: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 2,
      }}
    >
      {years.map((year) => {
        const active = year === selected;
        return (
          <Pressable
            key={year}
            onPress={() => setSelected(year)}
            style={{ alignItems: 'center', paddingVertical: 4, minWidth: 44 }}
          >
            <TText
              className="text-xs font-medium"
              style={{ color: active ? theme.gold : theme.textTertiary }}
            >
              {year}
            </TText>
            <View
              style={{
                marginTop: 5,
                height: 1.5,
                width: active ? 28 : 0,
                borderRadius: 1,
                backgroundColor: theme.gold,
              }}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
