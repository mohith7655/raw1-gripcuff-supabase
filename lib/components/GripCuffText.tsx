import React from 'react';
import { Text, TextStyle } from 'react-native';

// Inline component — renders Grip + small-c + uff inside an existing <Text>
// Usage: <Text style={s.title}><GC />Training</Text>
// Or as standalone: <GC style={s.title} />
export function GC({ style }: { style?: TextStyle | TextStyle[] }) {
  const flat: TextStyle = Array.isArray(style)
    ? Object.assign({}, ...(style as TextStyle[]))
    : (style ?? {});
  const fontSize = (flat.fontSize as number | undefined) ?? 14;
  const smallStyle: TextStyle = {
    fontSize: fontSize * 0.68,
    fontWeight: flat.fontWeight,
    color: flat.color,
  };

  if (style) {
    // Standalone usage — wraps in its own Text
    return (
      <Text style={style}>
        {'Grip'}<Text style={smallStyle}>{'c'}</Text>{'uff'}
      </Text>
    );
  }

  // Inline usage inside an outer Text — no wrapper
  return <>{'Grip'}<Text style={{ fontSize: '0.68em' as any }}>{'c'}</Text>{'uff'}</>;
}
