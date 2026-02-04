import Svg, { Path } from 'react-native-svg';
import { StampeoColors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface StampeoLogoProps {
  size?: number;
  color?: string;
}

export function StampeoLogo({ size = 32, color }: StampeoLogoProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const fillColor = color ?? StampeoColors[colorScheme].accent;

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Path
        d="M12.0799 24L4 19.2479L9.95537 8.75216L18.04 13.4961L18.0446 4H29.9554L29.96 13.4961L38.0446 8.75216L44 19.2479L35.92 24L44 28.7521L38.0446 39.2479L29.96 34.5039L29.9554 44H18.0446L18.04 34.5039L9.95537 39.2479L4 28.7521L12.0799 24Z"
        fill={fillColor}
        fillRule="evenodd"
        clipRule="evenodd"
      />
    </Svg>
  );
}
