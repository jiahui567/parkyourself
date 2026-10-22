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

export function TrashIcon(props) {
  return (
    <Icon {...props}>
      <Path d="M3 6h18" />
      <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <Path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <Path d="M10 11v6" />
      <Path d="M14 11v6" />
    </Icon>
  );
}

export function ChevronLeftIcon(props) {
  return (
    <Icon {...props}>
      <Path d="m15 18-6-6 6-6" />
    </Icon>
  );
}

export function CalendarIcon(props) {
  return (
    <Icon {...props}>
      <Path d="M8 2v4" />
      <Path d="M16 2v4" />
      <Rect width="18" height="18" x="3" y="4" rx="2" />
      <Path d="M3 10h18" />
    </Icon>
  );
}

export function TimerIcon(props) {
  return (
    <Icon {...props}>
      <Path d="M10 2h4" />
      <Path d="m12 14 3-3" />
      <Circle cx="12" cy="14" r="8" />
    </Icon>
  );
}

export function MapPinIcon(props) {
  return (
    <Icon {...props}>
      <Path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
      <Circle cx="12" cy="10" r="3" />
    </Icon>
  );
}

// Lucide's share-2 (three linked dots), the share symbol Android users know.
export function ShareIcon(props) {
  return (
    <Icon {...props}>
      <Circle cx="18" cy="5" r="3" />
      <Circle cx="6" cy="12" r="3" />
      <Circle cx="18" cy="19" r="3" />
      <Path d="m8.59 13.51 6.83 3.98" />
      <Path d="m15.41 6.51-6.82 3.98" />
    </Icon>
  );
}

export function SearchIcon(props) {
  return (
    <Icon {...props}>
      <Circle cx="11" cy="11" r="8" />
      <Path d="m21 21-4.3-4.3" />
    </Icon>
  );
}

export function PencilIcon(props) {
  return (
    <Icon {...props}>
      <Path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
      <Path d="m15 5 4 4" />
    </Icon>
  );
}

export function CameraIcon(props) {
  return (
    <Icon {...props}>
      <Path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <Circle cx="12" cy="13" r="3" />
    </Icon>
  );
}

export function XIcon(props) {
  return (
    <Icon {...props}>
      <Path d="M18 6 6 18" />
      <Path d="m6 6 12 12" />
    </Icon>
  );
}

export function ChevronDownIcon(props) {
  return (
    <Icon {...props}>
      <Path d="m6 9 6 6 6-6" />
    </Icon>
  );
}

// Lucide's image, for choosing a photo from the gallery.
export function ImageIcon(props) {
  return (
    <Icon {...props}>
      <Rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <Circle cx="9" cy="9" r="2" />
      <Path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </Icon>
  );
}

// Lucide's sticky-note, for the free-text note.
export function NoteIcon(props) {
  return (
    <Icon {...props}>
      <Path d="M15.5 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z" />
      <Path d="M15 3v6h6" />
    </Icon>
  );
}
