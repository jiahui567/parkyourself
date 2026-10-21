import Svg, { Circle, Path, Polygon, Rect } from 'react-native-svg';

// Line icons on a 24 x 24 grid. Shapes adapted from Lucide (lucide.dev, ISC
// licence), drawn with react-native-svg so no icon library is needed.

function Icon({ size = 24, color, children }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

export function HomeIcon(props) {
  return (
    <Icon {...props}>
      <Path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
      <Path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </Icon>
  );
}

export function HistoryIcon(props) {
  return (
    <Icon {...props}>
      <Path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <Path d="M3 3v5h5" />
      <Path d="M12 7v5l4 2" />
    </Icon>
  );
}

export function SpendingIcon(props) {
  return (
    <Icon {...props}>
      <Path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <Path d="M18 17V9" />
      <Path d="M13 17V5" />
      <Path d="M8 17v-3" />
    </Icon>
  );
}

export function SettingsIcon(props) {
  return (
    <Icon {...props}>
      <Path d="M20 7h-9" />
      <Path d="M14 17H5" />
      <Circle cx="17" cy="17" r="3" />
      <Circle cx="7" cy="7" r="3" />
    </Icon>
  );
}

export function FindIcon(props) {
  return (
    <Icon {...props}>
      <Polygon points="3 11 22 2 13 21 11 13 3 11" />
    </Icon>
  );
}

export function ChevronRightIcon(props) {
  return (
    <Icon {...props}>
      <Path d="m9 18 6-6-6-6" />
    </Icon>
  );
}

export function CarIcon(props) {
  return (
    <Icon {...props}>
      <Path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
      <Circle cx="7" cy="17" r="2" />
      <Path d="M9 17h6" />
      <Circle cx="17" cy="17" r="2" />
    </Icon>
  );
}

export function ArchiveIcon(props) {
  return (
    <Icon {...props}>
      <Rect width="20" height="5" x="2" y="3" rx="1" />
      <Path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <Path d="M10 12h4" />
    </Icon>
  );
}

export function PlusIcon(props) {
  return (
    <Icon {...props}>
      <Path d="M5 12h14" />
      <Path d="M12 5v14" />
    </Icon>
  );
}
