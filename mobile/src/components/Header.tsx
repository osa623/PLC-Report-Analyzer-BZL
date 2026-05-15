import { Pressable, View } from 'react-native';
import { IconGlyph } from '@/components/IconGlyph';
import { TText } from '@/components/Themed';
import { useAppTheme, useThemeStore } from '@/store/useThemeStore';

type Props = {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  right?: 'filter' | 'bell' | 'theme';
};

export function Header({ title, subtitle, showBack, right = 'theme' }: Props) {
  const theme = useAppTheme();
  const toggleMode = useThemeStore((state) => state.toggleMode);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 4,
        paddingBottom: 10,
      }}
    >
      <View style={{ width: 36 }}>
        {showBack ? (
          <IconGlyph name="back" color={theme.text} size={20} />
        ) : (
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              backgroundColor: `${theme.royal}18`,
              borderWidth: 0.5,
              borderColor: `${theme.royal}30`,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconGlyph name="shield" color={theme.royal} size={16} />
          </View>
        )}
      </View>
      <View style={{ flex: 1, alignItems: 'center' }}>
        {title ? (
          <TText className="text-sm font-semibold tracking-wide">{title}</TText>
        ) : null}
        {subtitle ? (
          <TText className="text-[9px] font-light opacity-50 mt-0.5">{subtitle}</TText>
        ) : null}
      </View>
      <Pressable
        onPress={right === 'theme' ? toggleMode : undefined}
        style={{
          height: 30,
          width: 30,
          borderRadius: 8,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: `${theme.gold}12`,
          borderWidth: 0.5,
          borderColor: `${theme.gold}25`,
        }}
      >
        {right === 'filter' ? (
          <IconGlyph name="filter" color={theme.textSecondary} size={16} />
        ) : right === 'bell' ? (
          <IconGlyph name="bell" color={theme.textSecondary} size={16} />
        ) : (
          <IconGlyph name="spark" color={theme.gold} size={16} />
        )}
      </Pressable>
    </View>
  );
}
