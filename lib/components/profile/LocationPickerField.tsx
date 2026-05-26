import React from 'react';
import { Platform } from 'react-native';
import { LocationPickerField as NativeLocationPickerField } from './LocationPickerField.native';
import { LocationPickerField as WebLocationPickerField } from './LocationPickerField.web';
import type { LocationValue as NativeLocationValue } from './LocationPickerField.native';

export type LocationValue = NativeLocationValue;

type Props = {
    value: LocationValue | null;
    onChange: (loc: LocationValue) => void;
};

export const LocationPickerField = (Platform.OS === 'web'
    ? (WebLocationPickerField as React.ComponentType<Props>)
    : (NativeLocationPickerField as React.ComponentType<Props>));
