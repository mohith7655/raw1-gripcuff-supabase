import React from 'react';
import { Platform } from 'react-native';
import { CityPickerField as NativeCityPickerField } from './CityPickerField.native';
import { CityPickerField as WebCityPickerField } from './CityPickerField.web';
import type { CityValue as NativeCityValue } from './CityPickerField.native';

export type CityValue = NativeCityValue;

type Props = {
    value: CityValue | null;
    onChange: (val: CityValue) => void;
};

export const CityPickerField = (Platform.OS === 'web'
    ? (WebCityPickerField as React.ComponentType<Props>)
    : (NativeCityPickerField as React.ComponentType<Props>));
