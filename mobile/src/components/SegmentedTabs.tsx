import { useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { TText } from '@/components/Themed';
import { useAppTheme } from '@/store/useThemeStore';

export function SegmentedTabs({ tabs, activeIndex = 0, onChange }: { tabs: string[]; activeIndex?: number; onChange?: (i: number) => void }) {
  const theme = useAppTheme();
  const [selected, setSelected] = useState(activeIndex);

  const handlePress = (index: number) => {
    setSelected(index);
    onChange?.(index);
  };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
      {tabs.map((tab, index) => {
        const active = index === selected;
        return (
          <Pressable
            key={tab}
            onPress={() => handlePress(index)}
            style={{
              marginRight: 6,
              minWidth: 72,
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 7,
              alignItems: 'center',
              backgroundColor: active ? theme.royal : theme.mode === 'dark' ? 'rgba(11,33,64,0.6)' : theme.white,
              borderColor: active ? theme.royal : theme.borderLight,
              borderWidth: 0.5,
            }}
          >
            <TText
              className="text-[10px] font-medium tracking-wide"
              style={{ color: active ? theme.white : theme.textSecondary }}
            >
              {tab}
            </TText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
