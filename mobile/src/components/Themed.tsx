import { PropsWithChildren } from 'react';
import { Platform, Text, TextProps, View, ViewProps } from 'react-native';
import { useAppTheme } from '@/store/useThemeStore';

function textClassStyle(className?: string) {
  if (!className) return null;
  const out: Record<string, unknown> = {};
  const tokens = className.split(/\s+/);
  for (const token of tokens) {
    // Font sizes — tuned smaller for a professional, data-dense UI
    if (token === 'text-[8px]') out.fontSize = 8;
    if (token === 'text-[9px]') out.fontSize = 9;
    if (token === 'text-[10px]') out.fontSize = 10;
    if (token === 'text-xs') out.fontSize = 10;
    if (token === 'text-sm') out.fontSize = 12;
    if (token === 'text-base') out.fontSize = 13;
    if (token === 'text-md') out.fontSize = 14;
    if (token === 'text-lg') out.fontSize = 15;
    if (token === 'text-xl') out.fontSize = 18;
    if (token === 'text-2xl') out.fontSize = 22;
    if (token === 'text-3xl') out.fontSize = 26;
    if (token === 'text-4xl') out.fontSize = 32;
    if (token === 'text-5xl') out.fontSize = 40;
    // Font weights
    if (token === 'font-thin') out.fontWeight = '100';
    if (token === 'font-extralight') out.fontWeight = '200';
    if (token === 'font-light') out.fontWeight = '300';
    if (token === 'font-normal') out.fontWeight = '400';
    if (token === 'font-medium') out.fontWeight = '500';
    if (token === 'font-semibold') out.fontWeight = '600';
    if (token === 'font-bold') out.fontWeight = '700';
    if (token === 'font-extrabold') out.fontWeight = '800';
    if (token === 'font-black') out.fontWeight = '900';
    // Opacity
    if (token === 'opacity-30') out.opacity = 0.3;
    if (token === 'opacity-40') out.opacity = 0.4;
    if (token === 'opacity-50') out.opacity = 0.5;
    if (token === 'opacity-60') out.opacity = 0.6;
    if (token === 'opacity-65') out.opacity = 0.65;
    if (token === 'opacity-70') out.opacity = 0.7;
    if (token === 'opacity-75') out.opacity = 0.75;
    if (token === 'opacity-80') out.opacity = 0.8;
    if (token === 'opacity-85') out.opacity = 0.85;
    if (token === 'opacity-90') out.opacity = 0.9;
    // Text alignment
    if (token === 'text-center') out.textAlign = 'center';
    if (token === 'text-right') out.textAlign = 'right';
    if (token === 'uppercase') out.textTransform = 'uppercase';
    if (token === 'capitalize') out.textTransform = 'capitalize';
    // Letter spacing
    if (token === 'tracking-tight') out.letterSpacing = -0.3;
    if (token === 'tracking-normal') out.letterSpacing = 0;
    if (token === 'tracking-wide') out.letterSpacing = 0.4;
    if (token === 'tracking-wider') out.letterSpacing = 0.8;
    if (token === 'tracking-widest') out.letterSpacing = 1.4;
    // Line height
    if (token === 'leading-4') out.lineHeight = 16;
    if (token === 'leading-5') out.lineHeight = 18;
    if (token === 'leading-6') out.lineHeight = 22;
    if (token === 'leading-7') out.lineHeight = 26;
    if (token === 'leading-none') out.lineHeight = undefined;
    // Margins
    if (token === 'mt-0.5') out.marginTop = 2;
    if (token === 'mt-1') out.marginTop = 4;
    if (token === 'mt-1.5') out.marginTop = 6;
    if (token === 'mt-2') out.marginTop = 8;
    if (token === 'mt-3') out.marginTop = 10;
    if (token === 'mt-4') out.marginTop = 14;
    if (token === 'mt-5') out.marginTop = 18;
    if (token === 'mb-0.5') out.marginBottom = 2;
    if (token === 'mb-1') out.marginBottom = 4;
    if (token === 'ml-1') out.marginLeft = 4;
    if (token === 'ml-1.5') out.marginLeft = 6;
    if (token === 'ml-2') out.marginLeft = 8;
    if (token === 'ml-3') out.marginLeft = 10;
    if (token === 'ml-4') out.marginLeft = 14;
    if (token === 'mr-1') out.marginRight = 4;
    if (token === 'mr-2') out.marginRight = 8;
    if (token === 'mr-3') out.marginRight = 10;
    if (token === 'flex-1') out.flex = 1;
  }
  return out;
}

export function ScreenView({ children, style, ...props }: PropsWithChildren<ViewProps>) {
  const theme = useAppTheme();
  return (
    <View style={[{ flex: 1, backgroundColor: theme.background }, style]} {...props}>
      {children}
    </View>
  );
}

export function TText({ children, style, ...props }: PropsWithChildren<TextProps & { className?: string }>) {
  const theme = useAppTheme();
  const { className, ...rest } = props;
  return (
    <Text
      style={[
        {
          color: theme.text,
          fontFamily: Platform.select({ ios: 'Avenir Next', android: 'sans-serif-light', default: undefined }),
          fontSize: 12,
          fontWeight: '400',
        },
        textClassStyle(className),
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}
